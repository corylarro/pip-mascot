import UIKit

/// Watches the app and lets Critter react by itself:
/// typing in a field, password fields, the keyboard, coming back to the app, and screenshots.
@MainActor
final class CritterAutopilot: NSObject {
    static let shared = CritterAutopilot()

    private var running = false
    private var backgroundedAt: Date?

    func start() {
        guard !running else { return }
        running = true
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(fieldBegan(_:)), name: UITextField.textDidBeginEditingNotification, object: nil)
        nc.addObserver(self, selector: #selector(fieldEnded(_:)), name: UITextField.textDidEndEditingNotification, object: nil)
        nc.addObserver(self, selector: #selector(textViewBegan(_:)), name: UITextView.textDidBeginEditingNotification, object: nil)
        nc.addObserver(self, selector: #selector(keyboardChanged(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        nc.addObserver(self, selector: #selector(keyboardHiding(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        nc.addObserver(self, selector: #selector(wentToBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(cameBack), name: UIApplication.willEnterForegroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(tookScreenshot), name: UIApplication.userDidTakeScreenshotNotification, object: nil)
    }

    func stop() {
        guard running else { return }
        running = false
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: Fields

    @objc private func fieldBegan(_ note: Notification) {
        guard let field = note.object as? UITextField else { return }
        Critter.coverEyes(field.isSecureTextEntry)
        let r = field.convert(field.bounds, to: nil)
        Critter.look(at: CGPoint(x: r.midX, y: r.midY))
    }

    @objc private func fieldEnded(_ note: Notification) {
        Critter.coverEyes(false)
    }

    @objc private func textViewBegan(_ note: Notification) {
        guard let view = note.object as? UITextView else { return }
        Critter.coverEyes(false)
        let r = view.convert(view.bounds, to: nil)
        Critter.look(at: CGPoint(x: r.midX, y: r.midY))
    }

    // MARK: Keyboard: Critter sits on top of it so it stays in view

    @objc private func keyboardChanged(_ note: Notification) {
        guard let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue else { return }
        let screenHeight = UIScreen.main.bounds.height
        if frame.minY >= screenHeight - 1 || frame.height < 60 {
            Critter.call("keyboard", NSNull())
        } else {
            Critter.call("keyboard", Double(frame.minY))
        }
    }

    @objc private func keyboardHiding(_ note: Notification) {
        Critter.call("keyboard", NSNull())
    }

    // MARK: Coming back

    @objc private func wentToBackground() {
        backgroundedAt = Date()
    }

    @objc private func cameBack() {
        guard let then = backgroundedAt, Date().timeIntervalSince(then) > 20 else { return }
        backgroundedAt = nil
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            Critter.react(.wave)
            Critter.say("Welcome back!")
        }
    }

    @objc private func tookScreenshot() {
        Critter.react(.love)
        Critter.say("Ooh, did I make it in?")
    }
}
