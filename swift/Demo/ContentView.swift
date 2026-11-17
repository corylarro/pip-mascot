import SwiftUI
import PipMascot

// Stillwater: a small meditation app that shows off Pip.
// Sign up, then keep a streak, check in on your mood and breathe with Pip.
// Long-press the Stillwater logo or your initial for the demo controls.
// Needs iOS 17 or later.

// MARK: - Look

enum Still {
    static let night = Color(red: 0.055, green: 0.090, blue: 0.149)   // #0E1726
    static let lake  = Color(red: 0.086, green: 0.188, blue: 0.290)   // #16304A
    static let moon  = Color(red: 0.957, green: 0.922, blue: 0.851)   // #F4EBD9
    static let mist  = Color(red: 0.957, green: 0.922, blue: 0.851).opacity(0.64)
    static let sage  = Color(red: 0.561, green: 0.827, blue: 0.753)   // #8FD3C0
    static let ember = Color(red: 1.000, green: 0.624, blue: 0.353)   // #FF9F5A
    static let coral = Color(red: 1.000, green: 0.541, blue: 0.478)   // #FF8A7A
    static let card  = Color.white.opacity(0.07)
    static let line  = Color.white.opacity(0.12)

    static func title(_ size: CGFloat) -> Font { .system(size: size, weight: .medium, design: .serif) }
}

// MARK: - App state

enum DayMark { case open, done, rest }

@MainActor
@Observable
final class DemoState {
    var userName: String? = nil
    var serverDown: Bool = false
    var today: DayMark = .open

    /// Six days already done; today adds one when finished. Rest days keep the streak.
    var streak: Int { 6 + (today == .done ? 1 : 0) }

    func reset() {
        userName = nil
        serverDown = false
        today = .open
    }
}

// MARK: - Root

@MainActor
struct ContentView: View {
    @State private var demo: DemoState = DemoState()

    init() {}

    var body: some View {
        ZStack {
            LakeBackground()
            if demo.userName == nil {
                SignUpView(demo: demo)
                    .transition(.opacity)
            } else {
                HomeView(demo: demo)
                    .transition(.opacity.combined(with: .move(edge: .trailing)))
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Sign up

@MainActor
struct SignUpView: View {
    enum Field: String, Hashable { case name, email, password }

    let demo: DemoState
    @State private var name: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var invalid: Field? = nil
    @State private var hint: String? = nil
    @State private var busy: Bool = false
    @FocusState private var focus: Field?

    init(demo: DemoState) {
        self.demo = demo
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                BrandMark()
                    .contextMenu { DemoMenu(demo: demo) }
                    .padding(.top, 12)

                Text("Five quiet minutes,\nevery day.")
                    .font(Still.title(36))
                    .foregroundStyle(Still.moon)
                    .padding(.top, 48)

                Text("Make an account so your streak follows you.")
                    .font(.callout)
                    .foregroundStyle(Still.mist)
                    .padding(.top, 10)

                VStack(spacing: 12) {
                    TextField("", text: $name, prompt: Text("Your name").foregroundStyle(Still.mist))
                        .textContentType(.givenName)
                        .submitLabel(.next)
                        .focused($focus, equals: .name)
                        .onSubmit { focus = .email }
                        .modifier(StillField(icon: "person", focused: focus == .name, invalid: invalid == .name))
                        .pipTarget("name")

                    TextField("", text: $email, prompt: Text("Email").foregroundStyle(Still.mist))
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .focused($focus, equals: .email)
                        .onSubmit { focus = .password }
                        .modifier(StillField(icon: "envelope", focused: focus == .email, invalid: invalid == .email))
                        .pipTarget("email")

                    SecureField("", text: $password, prompt: Text("Password, 8 or more characters").foregroundStyle(Still.mist))
                        .submitLabel(.go)
                        .focused($focus, equals: .password)
                        .onSubmit { createAccount() }
                        .modifier(StillField(icon: "lock", focused: focus == .password, invalid: invalid == .password))
                        .pipTarget("password")

                    if let hint {
                        Text(hint)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Still.coral)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 4)
                            .transition(.opacity)
                    }
                }
                .padding(.top, 36)

                Button {
                    createAccount()
                } label: {
                    ZStack {
                        if busy {
                            ProgressView().tint(Still.night)
                        } else {
                            Text("Create account")
                        }
                    }
                    .font(.headline)
                    .foregroundStyle(Still.night)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Capsule().fill(Still.moon))
                }
                .buttonStyle(PressStyle())
                .disabled(busy)
                .padding(.top, 24)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 160)
        }
        .scrollDismissesKeyboard(.interactively)
        .onChange(of: name) { clear(.name) }
        .onChange(of: email) { clear(.email) }
        .onChange(of: password) { clear(.password) }
    }

    private func createAccount() {
        let first = name.trimmingCharacters(in: .whitespaces)
        if first.isEmpty {
            flag(.name, "Add your name so we know what to call you.", pip: "What should we call you?")
            return
        }
        if !email.contains("@") || !email.contains(".") {
            flag(.email, "That email doesn't look quite right.", pip: "That email looks a little off.")
            return
        }
        if password.count < 8 {
            flag(.password, "Passwords need 8 or more characters.", pip: "A few more characters?")
            return
        }

        focus = nil
        busy = true
        let failing = demo.serverDown
        Task {
            do {
                try await Pip.watch(thinking: "Setting things up…",
                                    success: "Welcome, \(first)!",
                                    failure: "The server's having a moment. Try again?") {
                    try await Task.sleep(nanoseconds: 1_400_000_000)
                    if failing { throw URLError(.badServerResponse) }
                }
                // Give Pip's cheer a moment on screen before moving on.
                try? await Task.sleep(nanoseconds: 1_300_000_000)
                withAnimation(.easeInOut(duration: 0.45)) { demo.userName = first }
            } catch {
                withAnimation(.easeOut(duration: 0.2)) { hint = "We couldn't reach the server. Try again in a moment." }
            }
            busy = false
        }
    }

    private func flag(_ field: Field, _ text: String, pip: String) {
        withAnimation(.easeOut(duration: 0.2)) {
            invalid = field
            hint = text
        }
        Pip.point(at: field.rawValue, say: pip)
    }

    private func clear(_ field: Field) {
        guard invalid == field else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            invalid = nil
            hint = nil
        }
    }
}

// MARK: - Home

enum Feeling: String, CaseIterable, Identifiable {
    case calm = "Calm", tired = "Tired", stressed = "Stressed", great = "Great"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .calm: return "😌"
        case .tired: return "🥱"
        case .stressed: return "😣"
        case .great: return "✨"
        }
    }
}

@MainActor
struct HomeView: View {
    let demo: DemoState
    @State private var feeling: Feeling? = nil
    @State private var breathing: Bool = false
    @State private var bump: Int = 0

    init(demo: DemoState) {
        self.demo = demo
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                streakCard
                feelings
                sessionCard
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 160)
        }
        .sensoryFeedback(.success, trigger: bump)
        .fullScreenCover(isPresented: $breathing) {
            BreathingView { completed in
                breathing = false
                if completed { finishSession() }
            }
        }
    }

    // Greeting and the demo menu (long-press your initial).
    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(.callout)
                    .foregroundStyle(Still.mist)
                Text(demo.userName ?? "friend")
                    .font(Still.title(36))
                    .foregroundStyle(Still.moon)
                Text(Date.now, format: .dateTime.weekday(.wide).month(.wide).day())
                    .font(.footnote)
                    .foregroundStyle(Still.mist)
                    .padding(.top, 2)
            }
            Spacer()
            Text(String((demo.userName ?? "S").prefix(1)).uppercased())
                .font(.headline)
                .foregroundStyle(Still.night)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Still.sage))
                .contextMenu { DemoMenu(demo: demo) }
        }
    }

    private var streakCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "flame.fill")
                    .font(.title2)
                    .foregroundStyle(Still.ember)
                    .symbolEffect(.bounce, value: bump)
                Text("\(demo.streak)")
                    .font(Still.title(48))
                    .foregroundStyle(Still.moon)
                    .contentTransition(.numericText())
                Text("day streak")
                    .font(.callout)
                    .foregroundStyle(Still.mist)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Best").font(.caption).foregroundStyle(Still.mist)
                    Text("14 days").font(.footnote.weight(.semibold)).foregroundStyle(Still.moon)
                }
            }
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    VStack(spacing: 8) {
                        Text(weekLetters[i])
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(i == 6 ? Still.moon : Still.mist)
                        DayDot(mark: i < 6 ? .done : demo.today, isToday: i == 6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [Still.sage.opacity(0.16), Still.card],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Still.line, lineWidth: 1))
        .pipTarget("streak")
    }

    private var feelings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How are you feeling tonight?")
                .font(.headline)
                .foregroundStyle(Still.moon)
            HStack(spacing: 10) {
                ForEach(Feeling.allCases) { f in
                    Button {
                        pick(f)
                    } label: {
                        VStack(spacing: 6) {
                            Text(f.emoji).font(.title2)
                            Text(f.rawValue).font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(feeling == f ? Still.night : Still.moon)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(feeling == f ? Still.moon : Still.card)
                        )
                    }
                    .buttonStyle(PressStyle())
                }
            }
        }
    }

    private var sessionCard: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tonight's session")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Still.sage)
                    Text("Evening wind-down")
                        .font(Still.title(24))
                        .foregroundStyle(Still.moon)
                    Text("Ten minutes of slow breathing")
                        .font(.footnote)
                        .foregroundStyle(Still.mist)
                }
                Spacer()
                BreathOrb(size: 64)
            }

            Button {
                breathing = true
            } label: {
                Text(sessionButtonTitle)
                    .font(.headline)
                    .foregroundStyle(demo.today == .open ? Still.night : Still.mist)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Capsule().fill(demo.today == .open ? Still.moon : Still.card))
            }
            .buttonStyle(PressStyle())
            .disabled(demo.today != .open)

            if demo.today == .open {
                Button("Take a rest day") { rest() }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Still.mist)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Still.card))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Still.line, lineWidth: 1))
        .pipTarget("session")
    }

    private var sessionButtonTitle: String {
        switch demo.today {
        case .open: return "Begin session"
        case .done: return "Done for today"
        case .rest: return "Resting today"
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning," }
        if hour < 18 { return "Good afternoon," }
        return "Good evening,"
    }

    /// One-letter weekday names for the last seven days, ending today.
    private var weekLetters: [String] {
        let cal = Calendar.current
        let symbols = cal.veryShortWeekdaySymbols
        return (0..<7).map { i in
            let date = cal.date(byAdding: .day, value: i - 6, to: Date()) ?? Date()
            return symbols[cal.component(.weekday, from: date) - 1]
        }
    }

    private func pick(_ f: Feeling) {
        withAnimation(.easeOut(duration: 0.2)) { feeling = f }
        switch f {
        case .calm:
            Pip.react(.love)
            Pip.say("Love that. Let's keep it going.")
        case .tired:
            Pip.react(.sleeping, for: 2.2)
            Pip.say("Same. A short one tonight?")
        case .stressed:
            Pip.go(to: "session", sit: true, mood: .love, say: "Let's breathe it out together.")
        case .great:
            Pip.react(.success)
            Pip.say("Yes! Ride that wave.")
        }
    }

    private func finishSession() {
        Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { demo.today = .done }
            bump += 1
            Pip.celebrate(at: "streak", say: "\(demo.streak) days in a row! So proud of you.")
        }
    }

    private func rest() {
        withAnimation(.easeOut(duration: 0.25)) { demo.today = .rest }
        Pip.go(to: "streak", sit: true, mood: .love, say: "Rest days count too. See you tomorrow?")
    }
}

// MARK: - Breathing session

@MainActor
struct BreathingView: View {
    let onFinish: (Bool) -> Void
    @State private var inhale: Bool = false
    @State private var cycle: Int = 1
    private let cycles: Int = 2

    init(onFinish: @escaping (Bool) -> Void) {
        self.onFinish = onFinish
    }

    var body: some View {
        ZStack {
            LakeBackground()
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button {
                        onFinish(false)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.headline)
                            .foregroundStyle(Still.mist)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Still.card))
                    }
                    .accessibilityLabel("End session")
                }
                Spacer()
                ZStack {
                    Circle()
                        .stroke(Still.sage.opacity(0.2), lineWidth: 1)
                        .frame(width: 290, height: 290)
                    Circle()
                        .fill(RadialGradient(colors: [Still.sage.opacity(0.85), Still.sage.opacity(0.12)],
                                             center: .center, startRadius: 0, endRadius: 150))
                        .frame(width: 270, height: 270)
                        .scaleEffect(inhale ? 1 : 0.5)
                }
                Text(inhale ? "Breathe in" : "Breathe out")
                    .font(Still.title(30))
                    .foregroundStyle(Still.moon)
                    .contentTransition(.opacity)
                    .padding(.top, 48)
                Text("Breath \(cycle) of \(cycles)")
                    .font(.footnote)
                    .foregroundStyle(Still.mist)
                    .padding(.top, 8)
                Spacer()
            }
            .padding(24)
        }
        .task { await run() }
    }

    private func run() async {
        Pip.say("Breathe with me.", for: 2.4)
        for c in 1...cycles {
            cycle = c
            withAnimation(.easeInOut(duration: 4)) { inhale = true }
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if Task.isCancelled { return }
            withAnimation(.easeInOut(duration: 4)) { inhale = false }
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if Task.isCancelled { return }
        }
        onFinish(true)
    }
}

// MARK: - Pieces

@MainActor
struct LakeBackground: View {
    @State private var glow: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init() {}

    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(colors: [Still.night, Still.lake], startPoint: .top, endPoint: .bottom)
                // Moonlight in the top corner, slowly breathing.
                Circle()
                    .fill(RadialGradient(colors: [Still.moon.opacity(0.20), .clear],
                                         center: .center, startRadius: 0, endRadius: 190))
                    .frame(width: 380, height: 380)
                    .scaleEffect(glow ? 1.08 : 0.94)
                    .position(x: geo.size.width * 0.9, y: geo.size.height * 0.04)
                // Ripples on the water at the bottom.
                ZStack {
                    ForEach(0..<4, id: \.self) { i in
                        Ellipse()
                            .stroke(Still.moon.opacity(0.07 - Double(i) * 0.014), lineWidth: 1)
                            .frame(width: 220 + CGFloat(i) * 130, height: 44 + CGFloat(i) * 28)
                    }
                }
                .position(x: geo.size.width * 0.3, y: geo.size.height * 0.94)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) { glow = true }
        }
    }
}

@MainActor
struct BrandMark: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "moon.stars.fill")
                .foregroundStyle(Still.sage)
            Text("Stillwater")
                .font(.system(.headline, design: .serif))
                .foregroundStyle(Still.moon)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }
}

@MainActor
struct BreathOrb: View {
    let size: CGFloat
    @State private var inhale: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(size: CGFloat) {
        self.size = size
    }

    var body: some View {
        Circle()
            .fill(RadialGradient(colors: [Still.sage.opacity(0.9), Still.sage.opacity(0.12)],
                                 center: .center, startRadius: 0, endRadius: size * 0.6))
            .frame(width: size, height: size)
            .scaleEffect(inhale ? 1 : 0.72)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) { inhale = true }
            }
    }
}

@MainActor
struct DayDot: View {
    let mark: DayMark
    let isToday: Bool

    var body: some View {
        ZStack {
            Circle().fill(mark == .done ? Still.sage : Still.card)
            if isToday && mark == .open {
                Circle().strokeBorder(Still.sage.opacity(0.7), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
            }
            switch mark {
            case .done:
                Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(Still.night)
            case .rest:
                Image(systemName: "moon.fill").font(.caption).foregroundStyle(Still.sage)
            case .open:
                EmptyView()
            }
        }
        .frame(width: 34, height: 34)
    }
}

struct StillField: ViewModifier {
    let icon: String
    let focused: Bool
    let invalid: Bool

    func body(content: Content) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body.weight(.medium))
                .foregroundStyle(invalid ? Still.coral : (focused ? Still.sage : Still.mist))
                .frame(width: 22)
            content
                .foregroundStyle(Still.moon)
                .tint(Still.sage)
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Still.card))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(invalid ? Still.coral : (focused ? Still.sage.opacity(0.8) : Still.line),
                              lineWidth: focused || invalid ? 1.5 : 1)
        )
        .animation(.easeOut(duration: 0.15), value: focused)
        .animation(.easeOut(duration: 0.15), value: invalid)
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Demo controls (long-press the logo or your initial)

@MainActor
struct DemoMenu: View {
    @Bindable var demo: DemoState

    var body: some View {
        Toggle("Simulate a server outage", isOn: $demo.serverDown)
        Menu("Move Pip") {
            Button("Bottom right") { move(.bottomRight) }
            Button("Bottom left") { move(.bottomLeft) }
            Button("Top right") { move(.topRight) }
            Button("Top left") { move(.topLeft) }
        }
        Menu("Make Pip react") {
            Button("Wave") { Pip.react(.wave); Pip.say("Hello there!") }
            Button("Cheer") { Pip.react(.success); Pip.say("We did it!") }
            Button("Love") { Pip.react(.love) }
            Button("Nap") { Pip.set(.sleeping) }
            Button("Wake up") { Pip.set(.idle) }
        }
        Button("Hide Pip") { Pip.hide() }
        Button("Show Pip") { Pip.show() }
        Button("Restart the demo", role: .destructive) {
            withAnimation(.easeInOut(duration: 0.4)) { demo.reset() }
            Pip.home()
        }
    }

    private func move(_ corner: Pip.Corner) {
        var config = PipDemoSettings.configuration
        config.corner = corner
        config.greets = false
        Pip.start(config)
    }
}

enum PipDemoSettings {
    /// Swap in your own mascot id from the paint page. Set it to nil to try the drawn mascot.
    static let configuration = Pip.Configuration(
        mascotID: "fd89vpfu99qm",
        greeting: "Hi! I'm Pip. I'll keep you company."
    )
}

#Preview {
    ContentView()
}
