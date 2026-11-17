import UIKit

/// Pip: an animated mascot that lives on top of your app and reacts to what's happening.
///
///     Pip.start(.init(mascotID: "your-mascot-id"))
///     Pip.point(at: emailField, say: "That email looks off.")
///     Pip.celebrate(at: streakCard, say: "7 days in a row!")
///
/// Call it from the main thread (SwiftUI views and button actions already are).
@MainActor
public enum Pip {

    // MARK: - Types

    public typealias Corner = PipCorner
    public typealias Mood = PipMood
    public typealias Event = PipEvent
    public typealias Configuration = PipConfiguration

    /// Called when Pip finishes loading, is tapped, hidden, shown, or changes state.
    public static var onEvent: ((Event) -> Void)?

    // MARK: - Start and stop

    /// Show Pip on top of your app. Call again with a new configuration to change it.
    public static func start(_ configuration: Configuration = Configuration()) {
        PipOverlay.log("starting (\(configuration.mascotID.map { "painted " + $0 } ?? "drawn mascot"))")
        PipOverlay.shared.start(configuration)
        if configuration.autopilot { PipAutopilot.shared.start() } else { PipAutopilot.shared.stop() }
    }

    public static func stop() {
        PipAutopilot.shared.stop()
        PipOverlay.shared.stop()
    }

    // MARK: - Reactions

    /// Show a reaction for a moment, then go back to normal.
    public static func react(_ mood: Mood, for seconds: TimeInterval = 2.4) {
        call("react", mood.rawValue, ms(seconds))
    }

    /// Hold a state until you change it, for example `.thinking` while something loads.
    public static func set(_ mood: Mood) {
        call("setState", mood.rawValue)
    }

    /// Show a speech bubble.
    public static func say(_ text: String, for seconds: TimeInterval = 2.6) {
        call("say", text, ms(seconds))
    }

    /// Look toward a point on the screen.
    public static func look(at point: CGPoint) {
        call("lookAt", Double(point.x), Double(point.y))
    }

    public static func coverEyes(_ covered: Bool = true) {
        call("cover", covered)
    }

    /// Walk back to its corner (or onto the keyboard, if it's open).
    public static func home() { call("home") }
    public static func hide() { call("hide") }
    public static func show() { call("show") }

    // MARK: - Walking to things

    /// Walk to a view and point at it, for example a field that needs fixing.
    public static func point(at view: UIView, say text: String? = nil, mood: Mood = .error) {
        go(to: screenRect(of: view), sit: false, mood: mood, say: text)
    }

    /// Walk to a view, sit on it and cheer.
    public static func celebrate(at view: UIView, say text: String? = nil) {
        go(to: screenRect(of: view), sit: true, mood: .success, say: text)
    }

    /// Point at a SwiftUI view marked with `.pipTarget("id")`.
    public static func point(at target: String, say text: String? = nil, mood: Mood = .error) {
        go(to: target, sit: false, mood: mood, say: text)
    }

    /// Sit on a SwiftUI view marked with `.pipTarget("id")` and cheer.
    public static func celebrate(at target: String, say text: String? = nil) {
        go(to: target, sit: true, mood: .success, say: text)
    }

    /// Walk to a SwiftUI view marked with `.pipTarget("id")`.
    public static func go(to target: String, sit: Bool = true, mood: Mood? = nil, say text: String? = nil, stay: Bool = false) {
        guard let rect = PipTargets.frames[target] else {
            if let mood { react(mood) }
            if let text { say(text) }
            return
        }
        go(to: rect, sit: sit, mood: mood, say: text, stay: stay)
    }

    /// Walk to a rectangle in screen coordinates. Pip walks home afterwards unless `stay` is true.
    public static func go(to rect: CGRect, sit: Bool = true, mood: Mood? = nil, say text: String? = nil, stay: Bool = false) {
        let r: [String: Any] = ["x": Double(rect.minX), "y": Double(rect.minY), "w": Double(rect.width), "h": Double(rect.height)]
        var options: [String: Any] = ["mode": sit ? "sit" : "point", "stay": stay]
        if let mood { options["state"] = mood.rawValue }
        if let text { options["text"] = text }
        call("goTo", r, options)
    }

    // MARK: - Watching work

    /// Wrap async work: Pip thinks while it runs, then cheers or looks worried.
    ///
    ///     try await Pip.watch(success: "Saved!") { try await api.save(note) }
    @discardableResult
    public static func watch<T>(thinking: String? = nil,
                                success: String? = nil,
                                failure: String? = "Hmm, that didn't work. Try again?",
                                _ work: () async throws -> T) async rethrows -> T {
        set(.thinking)
        if let thinking { say(thinking) }
        do {
            let value = try await work()
            set(.idle)
            react(.success)
            if let success { say(success) }
            return value
        } catch {
            set(.idle)
            react(.error)
            if let failure { say(failure) }
            throw error
        }
    }

    // MARK: - Helpers

    static func call(_ function: String, _ args: Any...) {
        PipOverlay.shared.call("Pip." + function, args)
    }

    private static func ms(_ seconds: TimeInterval) -> Int { Int((seconds * 1000).rounded()) }

    /// Pip's layer covers the whole screen, so window coordinates line up with it.
    private static func screenRect(of view: UIView) -> CGRect {
        view.convert(view.bounds, to: nil)
    }
}

// MARK: - Types

public enum PipCorner: String, Sendable {
    case bottomRight = "bottom-right", bottomLeft = "bottom-left", topRight = "top-right", topLeft = "top-left"
}

public enum PipMood: String, Sendable {
    case idle, thinking, success, error, surprised, confused, love, wave, talking, sleeping
}

public enum PipEvent: Sendable {
    case ready, failedToLoad, tapped, hidden, shown
    case stateChanged(String)
}

public struct PipConfiguration: Sendable {
    /// Your painted mascot's id from the paint page. Leave nil for the drawn mascot.
    public var mascotID: String?
    public var corner: PipCorner
    /// Distance from the screen edges, on top of the safe area.
    public var offset: CGPoint
    /// Width of the mascot in points.
    public var size: CGFloat
    public var greets: Bool
    public var greeting: String?
    /// React to text fields, passwords, the keyboard and coming back to the app.
    public var autopilot: Bool
    /// Let people tap a small close button to put Pip away.
    public var hideable: Bool
    /// Seconds of quiet before Pip dozes off. 0 keeps it awake.
    public var sleepAfter: TimeInterval

    public init(mascotID: String? = nil,
                corner: PipCorner = .bottomRight,
                offset: CGPoint = CGPoint(x: 10, y: 6),
                size: CGFloat = 104,
                greets: Bool = true,
                greeting: String? = nil,
                autopilot: Bool = true,
                hideable: Bool = true,
                sleepAfter: TimeInterval = 30) {
        self.mascotID = mascotID
        self.corner = corner
        self.offset = offset
        self.size = size
        self.greets = greets
        self.greeting = greeting
        self.autopilot = autopilot
        self.hideable = hideable
        self.sleepAfter = sleepAfter
    }
}
