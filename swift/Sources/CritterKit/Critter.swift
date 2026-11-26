import UIKit

/// Critter: an animated mascot that lives on top of your app and reacts to what's happening.
///
///     Critter.start(.init(mascotID: "your-mascot-id"))
///     Critter.point(at: emailField, say: "That email looks off.")
///     Critter.celebrate(at: streakCard, say: "7 days in a row!")
///
/// Call it from the main thread (SwiftUI views and button actions already are).
@MainActor
public enum Critter {

    // MARK: - Types

    public typealias Corner = CritterCorner
    public typealias Mood = CritterMood
    public typealias Event = CritterEvent
    public typealias Configuration = CritterConfiguration
    public typealias Season = CritterSeason

    /// Called when Critter finishes loading, is tapped, hidden, shown, or changes state.
    public static var onEvent: ((Event) -> Void)?

    // MARK: - Start and stop

    /// Show Critter on top of your app. Call again with a new configuration to change it.
    public static func start(_ configuration: Configuration = Configuration()) {
        CritterOverlay.log("starting (\(configuration.mascotID.map { "painted " + $0 } ?? "drawn mascot"))")
        CritterOverlay.shared.start(configuration)
        if configuration.autopilot { CritterAutopilot.shared.start() } else { CritterAutopilot.shared.stop() }
    }

    public static func stop() {
        CritterAutopilot.shared.stop()
        CritterOverlay.shared.stop()
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

    /// Point at a SwiftUI view marked with `.critterTarget("id")`.
    public static func point(at target: String, say text: String? = nil, mood: Mood = .error) {
        go(to: target, sit: false, mood: mood, say: text)
    }

    /// Sit on a SwiftUI view marked with `.critterTarget("id")` and cheer.
    public static func celebrate(at target: String, say text: String? = nil) {
        go(to: target, sit: true, mood: .success, say: text)
    }

    /// Ready-made moments for the things that matter in an app.
    ///
    ///     Critter.moment(.firstPurchase)
    ///     Critter.moment(.streak(days: 7))
    ///     Critter.moment(.milestone, say: "100 notes written!", at: "notes")
    public enum Moment {
        case firstPurchase, purchase, milestone, goal, welcome, welcomeBack, empty, oops
        case streak(days: Int)
        case levelUp(_ level: Int? = nil)

        var name: String {
            switch self {
            case .firstPurchase: return "first-purchase"
            case .purchase: return "purchase"
            case .milestone: return "milestone"
            case .goal: return "goal"
            case .welcome: return "welcome"
            case .welcomeBack: return "welcome-back"
            case .empty: return "empty"
            case .oops: return "oops"
            case .streak: return "streak"
            case .levelUp: return "level-up"
            }
        }
        var count: Int? {
            switch self {
            case .streak(let days): return days
            case .levelUp(let level): return level
            default: return nil
            }
        }
    }

    /// Play a choreography, for example one made in the Moment studio at critterkit.com/studio.
    ///
    ///     Critter.play([["do": "flip"], ["do": "react", "state": "dance", "ms": 2500], ["do": "say", "text": "Level 5!"]])
    public static func play(_ steps: [[String: Any]]) {
        call("play", steps)
    }

    /// Play a moment, optionally walking over to a SwiftUI view marked with `.critterTarget("id")` first.
    public static func moment(_ moment: Moment, say text: String? = nil, at target: String? = nil) {
        var options: [String: Any] = [:]
        if let count = moment.count { options["count"] = count }
        if let text { options["say"] = text }
        if let target, let rect = CritterTargets.frames[target] {
            options["rect"] = ["x": Double(rect.minX), "y": Double(rect.minY), "w": Double(rect.width), "h": Double(rect.height)]
        }
        call("moment", moment.name, options)
    }

    /// Walk to a SwiftUI view marked with `.critterTarget("id")`.
    public static func go(to target: String, sit: Bool = true, mood: Mood? = nil, say text: String? = nil, stay: Bool = false) {
        guard let rect = CritterTargets.frames[target] else {
            if let mood { react(mood) }
            if let text { say(text) }
            return
        }
        go(to: rect, sit: sit, mood: mood, say: text, stay: stay)
    }

    /// Walk people through a screen: Critter points at each `.critterTarget` in turn, then heads home.
    ///
    ///     Critter.tour([("plan", "Pick a plan"), ("start", "Then tap here")], done: "You're all set!")
    public static func tour(_ steps: [(target: String, say: String)], done: String? = nil) {
        let list: [[String: Any]] = steps.compactMap { step in
            guard let r = CritterTargets.frames[step.target] else { return nil }
            let rect: [String: Any] = ["x": Double(r.minX), "y": Double(r.minY), "w": Double(r.width), "h": Double(r.height)]
            return ["r": rect, "text": step.say, "mode": "point"]
        }
        CritterOverlay.log("tour: \(list.count) of \(steps.count) targets found")
        guard !list.isEmpty else { return }
        if let done { call("tour", list, done) } else { call("tour", list, NSNull()) }
    }

    /// Force a seasonal effect (handy for screenshots), or go back to picking by date with `.auto`.
    public static func season(_ season: Season) { call("season", season.rawValue) }

    /// Stop a tour early and send Critter home.
    public static func stopTour() { call("stopTour") }

    /// Walk to a rectangle in screen coordinates. Critter walks home afterwards unless `stay` is true.
    public static func go(to rect: CGRect, sit: Bool = true, mood: Mood? = nil, say text: String? = nil, stay: Bool = false) {
        let r: [String: Any] = ["x": Double(rect.minX), "y": Double(rect.minY), "w": Double(rect.width), "h": Double(rect.height)]
        var options: [String: Any] = ["mode": sit ? "sit" : "point", "stay": stay]
        if let mood { options["state"] = mood.rawValue }
        if let text { options["text"] = text }
        call("goTo", r, options)
    }

    // MARK: - Watching work

    /// Wrap async work: Critter thinks while it runs, then cheers or looks worried.
    ///
    ///     try await Critter.watch(success: "Saved!") { try await api.save(note) }
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
        CritterOverlay.shared.call("Pip." + function, args)
    }

    private static func ms(_ seconds: TimeInterval) -> Int { Int((seconds * 1000).rounded()) }

    /// Critter's layer covers the whole screen, so window coordinates line up with it.
    private static func screenRect(of view: UIView) -> CGRect {
        view.convert(view.bounds, to: nil)
    }
}

// MARK: - Types

public enum CritterCorner: String, Sendable {
    case bottomRight = "bottom-right", bottomLeft = "bottom-left", topRight = "top-right", topLeft = "top-left"
}

public enum CritterSeason: String, Sendable {
    case auto, off, snow, leaves, confetti, hearts, bats
}

public enum CritterMood: String, Sendable {
    case idle, thinking, success, error, surprised, confused, love, wave, talking, sleeping
    /// A happy little dance with music notes. Good for big wins.
    case dance
    /// Slumps under a tiny rain cloud. Good for empty states and "nothing here yet".
    case sad
    /// Ducks down so only its head peeks up from the edge, then pops back up.
    case peek
}

public enum CritterEvent: Sendable {
    case ready, failedToLoad, tapped, hidden, shown
    case stateChanged(String)
}

public struct CritterConfiguration: Sendable {
    /// Your painted mascot's id from the paint page. Leave nil for the drawn mascot.
    public var mascotID: String?
    public var corner: CritterCorner
    /// Distance from the screen edges, on top of the safe area.
    public var offset: CGPoint
    /// Width of the mascot in points.
    public var size: CGFloat
    public var greets: Bool
    public var greeting: String?
    /// React to text fields, passwords, the keyboard and coming back to the app.
    public var autopilot: Bool
    /// Let people tap a small close button to put Critter away.
    public var hideable: Bool
    /// Seconds of quiet before Critter dozes off. 0 keeps it awake.
    public var sleepAfter: TimeInterval
    /// Holiday touches that drift around Critter by date (leaves in November, snow in December…). They never change how Critter looks.
    public var seasonal: Bool

    public init(mascotID: String? = nil,
                corner: CritterCorner = .bottomRight,
                offset: CGPoint = CGPoint(x: 10, y: 6),
                size: CGFloat = 104,
                greets: Bool = true,
                greeting: String? = nil,
                autopilot: Bool = true,
                hideable: Bool = true,
                sleepAfter: TimeInterval = 30,
                seasonal: Bool = true) {
        self.mascotID = mascotID
        self.corner = corner
        self.offset = offset
        self.size = size
        self.greets = greets
        self.greeting = greeting
        self.autopilot = autopilot
        self.hideable = hideable
        self.sleepAfter = sleepAfter
        self.seasonal = seasonal
    }
}
