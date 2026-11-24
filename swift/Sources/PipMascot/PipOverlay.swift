import UIKit
import WebKit

/// A see-through window above the app that holds the mascot.
/// Only taps on the mascot itself are caught; everything else falls through to the app.
final class PipWindow: UIWindow {
    var hitRect: CGRect = .zero

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !hitRect.isEmpty, hitRect.contains(point) else { return nil }
        return super.hitTest(point, with: event)
    }
}

/// Root of Pip's window. It hands status bar and rotation decisions back to the app's own screens.
final class PipViewController: UIViewController {
    override func loadView() {
        let v = UIView()
        v.backgroundColor = .clear
        view = v
    }

    private var appRoot: UIViewController? {
        guard let scene = view.window?.windowScene else { return nil }
        let appWindows = scene.windows.filter { !($0 is PipWindow) }
        return (appWindows.first { $0.isKeyWindow } ?? appWindows.first)?.rootViewController
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        appRoot?.childForStatusBarStyle?.preferredStatusBarStyle ?? appRoot?.preferredStatusBarStyle ?? .default
    }
    override var prefersStatusBarHidden: Bool {
        appRoot?.childForStatusBarHidden?.prefersStatusBarHidden ?? appRoot?.prefersStatusBarHidden ?? false
    }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        appRoot?.supportedInterfaceOrientations ?? .all
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        PipOverlay.shared.safeAreaChanged()
    }
}

/// Receives messages from the web view and passes them to the overlay on the main thread.
final class PipWebDelegate: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    weak var owner: PipOverlay?

    init(owner: PipOverlay) {
        self.owner = owner
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let target = owner
        Task { @MainActor in target?.didLoad() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        PipOverlay.log("page failed: \(error.localizedDescription)")
        Task { @MainActor in Pip.onEvent?(.failedToLoad) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        PipOverlay.log("page failed to start: \(error.localizedDescription)")
        Task { @MainActor in Pip.onEvent?(.failedToLoad) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // iOS can reclaim the web view's memory while the app is in the background; start it again.
        let target = owner
        Task { @MainActor in target?.reload() }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body
        let target = owner
        Task { @MainActor in target?.handle(body) }
    }
}

@MainActor
final class PipOverlay {
    static let shared = PipOverlay()

    private var window: PipWindow?
    private var webView: WKWebView?
    private var delegate: PipWebDelegate?
    private var loaded = false
    private var pending: [String] = []
    private var config = Pip.Configuration()
    private var sceneObserver: NSObjectProtocol?

    // MARK: Lifecycle

    func start(_ configuration: Pip.Configuration) {
        config = configuration
        if window == nil {
            attach()
        } else if loaded {
            sendInit()
        }
    }

    func stop() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "pip")
        window?.isHidden = true
        window = nil
        webView = nil
        delegate = nil
        loaded = false
        pending.removeAll()
    }

    func reload() {
        loaded = false
        loadPage()
    }

    private func activeScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }

    private func attach() {
        guard let scene = activeScene() else {
            log("no window scene yet, waiting for the app to become active")
            // Called before the app's window exists (for example in App.init); try again once a scene is active.
            if sceneObserver == nil {
                sceneObserver = NotificationCenter.default.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) { _ in
                    Task { @MainActor in PipOverlay.shared.sceneBecameActive() }
                }
            }
            return
        }

        let w = PipWindow(windowScene: scene)
        w.windowLevel = UIWindow.Level.normal + 1
        w.backgroundColor = .clear
        let vc = PipViewController()
        w.rootViewController = vc

        let d = PipWebDelegate(owner: self)
        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(d, name: "pip")
        cfg.allowsInlineMediaPlayback = true

        let web = WKWebView(frame: scene.coordinateSpace.bounds, configuration: cfg)
        web.translatesAutoresizingMaskIntoConstraints = false
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = d
        if #available(iOS 16.4, *) {
            web.isInspectable = true   // lets you inspect Pip from Safari's Develop menu while testing
        }
        vc.view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: vc.view.topAnchor),
            web.bottomAnchor.constraint(equalTo: vc.view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor)
        ])

        // Shown, but never made the key window, so the app keeps its keyboard and focus.
        w.isHidden = false

        window = w
        webView = web
        delegate = d
        log("overlay window created (\(Int(w.bounds.width))x\(Int(w.bounds.height)))")
        loadPage()
    }

    private func sceneBecameActive() {
        guard window == nil, activeScene() != nil else { return }
        if let o = sceneObserver {
            NotificationCenter.default.removeObserver(o)
            sceneObserver = nil
        }
        attach()
    }

    private func loadPage() {
        guard let web = webView else { return }
        guard let url = Bundle.module.url(forResource: "pip-mobile", withExtension: "html"),
              let html = try? String(contentsOf: url, encoding: .utf8) else {
            log("could not find pip-mobile.html in the package resources")
            Pip.onEvent?(.failedToLoad)
            return
        }
        // The base URL lets the page load painted mascots from Pip's servers.
        web.loadHTMLString(html, baseURL: URL(string: "https://pip-mascot.vercel.app/"))
    }

    func didLoad() {
        log("page loaded, starting the mascot")
        loaded = true
        sendInit()
        let queued = pending
        pending.removeAll()
        queued.forEach { run($0) }
    }

    // MARK: Talking to the page

    private func sendInit() {
        var c: [String: Any] = [
            "size": Double(config.size),
            "position": config.corner.rawValue,
            "greet": config.greets,
            "hideable": config.hideable,
            "sleepAfter": config.sleepAfter,
            "seasonal": config.seasonal ? "auto" : "off",
            "offset": offsets()
        ]
        if let id = config.mascotID { c["mascot"] = id }
        if let g = config.greeting { c["greeting"] = g }
        run(script("Pip.init", [c]))
    }

    /// Offsets from the screen edge, including the safe area (notch, home indicator).
    private func offsets() -> [Double] {
        let insets = window?.safeAreaInsets ?? .zero
        let left = config.corner == .bottomLeft || config.corner == .topLeft
        let top = config.corner == .topLeft || config.corner == .topRight
        let x = config.offset.x + (left ? insets.left : insets.right)
        let y = config.offset.y + (top ? insets.top : insets.bottom)
        return [Double(x), Double(y)]
    }

    func safeAreaChanged() {
        guard loaded else { return }
        run(script("Pip.setOffset", offsets()))
    }

    func call(_ function: String, _ args: [Any]) {
        let js = script(function, args)
        if loaded { run(js) } else { pending.append(js) }
    }

    private func script(_ function: String, _ args: [Any]) -> String {
        let cleaned: [Any] = args.map { (value: Any) -> Any in
            if let n = value as? CGFloat { return Double(n) }
            if value is NSNull { return NSNull() }
            return value
        }
        guard JSONSerialization.isValidJSONObject(cleaned),
              let data = try? JSONSerialization.data(withJSONObject: cleaned),
              let json = String(data: data, encoding: .utf8) else { return "" }
        return "(function(){ \(function).apply(null, \(json)); })();"
    }

    private func run(_ js: String) {
        guard !js.isEmpty else { return }
        webView?.evaluateJavaScript(js) { _, error in
            if let error { PipOverlay.log("script error: \(error.localizedDescription) in \(js.prefix(60))") }
        }
    }

    nonisolated static func log(_ text: String) {
        print("[Pip] \(text)")
    }

    private func log(_ text: String) { PipOverlay.log(text) }

    // MARK: Messages from the page

    func handle(_ body: Any) {
        guard let m = body as? [String: Any], let type = m["type"] as? String else { return }
        switch type {
        case "rect":
            let num = { (k: String) -> CGFloat in CGFloat((m[k] as? NSNumber)?.doubleValue ?? 0) }
            window?.hitRect = CGRect(x: num("x"), y: num("y"), width: num("w"), height: num("h"))
        case "log": log((m["level"] as? String == "error" ? "page error: " : "page: ") + (m["text"] as? String ?? ""))
        case "loaded": log("bridge ready")
        case "ready": log("mascot ready"); Pip.onEvent?(.ready)
        case "error": log("painted mascot failed to load"); Pip.onEvent?(.failedToLoad)
        case "tap": Pip.onEvent?(.tapped)
        case "hide": Pip.onEvent?(.hidden)
        case "show": Pip.onEvent?(.shown)
        case "statechange": Pip.onEvent?(.stateChanged(m["state"] as? String ?? ""))
        default: break
        }
    }
}
