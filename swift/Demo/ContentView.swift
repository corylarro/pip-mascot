import SwiftUI
import PipMascot

/// A test screen for Pip: a sign-up form and a meditation streak.
@MainActor
struct ContentView: View {
    enum Screen: String, CaseIterable { case signUp = "Sign up", streak = "Streak" }
    @State private var screen: Screen = .signUp

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Screen", selection: $screen) {
                    ForEach(Screen.allCases, id: \.self) { Text($0.rawValue) }
                }
                .pickerStyle(.segmented)
                .padding()

                switch screen {
                case .signUp: SignUpView()
                case .streak: StreakView()
                }
            }
            .navigationTitle("Pip test")
            .toolbar {
                ToolbarItem(placement: .primaryAction) { PipMenu() }
            }
        }
    }
}

// MARK: - Sign up

@MainActor
struct SignUpView: View {
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var serverDown = false
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        Form {
            Section("Create your account") {
                TextField("Name", text: $name)
                    .textContentType(.name)
                    .pipTarget("name")
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .pipTarget("email")
                SecureField("Password (8+ characters)", text: $password)
                    .pipTarget("password")
            }
            Section {
                Toggle("Pretend the server is down", isOn: $serverDown)
                Button(busy ? "Creating account…" : "Create account", action: createAccount)
                    .disabled(busy)
                if let message { Text(message).foregroundStyle(.secondary) }
            } footer: {
                Text("Try: tap Create account with everything empty. Type a password. Turn on the outage, then sign up.")
            }
        }
    }

    private func createAccount() {
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            Pip.point(at: "name", say: "What should we call you?")
            return
        }
        if !email.contains("@") || !email.contains(".") {
            Pip.point(at: "email", say: "That email looks off.")
            return
        }
        if password.count < 8 {
            Pip.point(at: "password", say: "Use at least 8 characters.")
            return
        }
        hideKeyboard()
        busy = true
        message = nil
        Task {
            do {
                try await Pip.watch(thinking: "Creating your account…", success: "Welcome aboard, \(name)!") {
                    try await pretendSignUp(failing: serverDown)
                }
                message = "Account created."
            } catch {
                message = "Our server is having a moment. Please try again."
            }
            busy = false
        }
    }

    private func pretendSignUp(failing: Bool) async throws {
        try await Task.sleep(nanoseconds: 1_400_000_000)
        if failing { throw URLError(.badServerResponse) }
    }
}

// MARK: - Streak

@MainActor
struct StreakView: View {
    @State private var days = [true, true, true, true, true, true, false]
    @State private var rested = false

    private var streak: Int { days.filter { $0 }.count }
    private var doneToday: Bool { days[6] || rested }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Evening wind-down").font(.title2.bold())
                    Text("10 minutes · breathing").foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "flame.fill").font(.title).foregroundStyle(.orange)
                        Text("\(streak)").font(.largeTitle.bold())
                        Text("days in a row").foregroundStyle(.secondary)
                    }
                    HStack(spacing: 8) {
                        ForEach(0..<7, id: \.self) { i in
                            let label = ["M", "T", "W", "T", "F", "S", "S"][i]
                            Text(label)
                                .font(.footnote.bold())
                                .frame(maxWidth: .infinity, minHeight: 36)
                                .background(Circle().fill(days[i] ? Color.green : Color.gray.opacity(0.18)))
                                .foregroundStyle(days[i] ? Color.white : Color.secondary)
                        }
                    }
                }
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 20).fill(Color(.secondarySystemBackground)))
                .pipTarget("streak")

                Button {
                    days[6] = true
                    Pip.celebrate(at: "streak", say: "A full week in a row! So proud of you.")
                } label: {
                    Text(doneToday ? "Done for today" : "Finish today's session").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(doneToday)

                Button("Skip today") {
                    rested = true
                    Pip.go(to: "streak", sit: true, mood: .confused, say: "Rest days count too. See you tomorrow?")
                }
                .disabled(doneToday)

                if doneToday {
                    Button("Reset the demo") {
                        days[6] = false
                        rested = false
                        Pip.home()
                    }
                    .font(.footnote)
                }
            }
            .padding()
        }
    }
}

// MARK: - Testing controls

@MainActor
struct PipMenu: View {
    var body: some View {
        Menu {
            Section("Move Pip") {
                Button("Bottom right") { restart(.bottomRight) }
                Button("Bottom left") { restart(.bottomLeft) }
                Button("Top right") { restart(.topRight) }
                Button("Top left") { restart(.topLeft) }
            }
            Section("Make Pip react") {
                Button("Wave") { Pip.react(.wave); Pip.say("Hello there!") }
                Button("Cheer") { Pip.react(.success); Pip.say("We did it!") }
                Button("Love") { Pip.react(.love) }
                Button("Nap") { Pip.set(.sleeping) }
                Button("Wake up") { Pip.set(.idle) }
            }
            Button("Hide Pip") { Pip.hide() }
            Button("Show Pip") { Pip.show() }
        } label: {
            Image(systemName: "face.smiling")
        }
    }

    private func restart(_ corner: Pip.Corner) {
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
        greeting: "Hi! I'm Pip. Try breaking something."
    )
}

@MainActor
private func hideKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}

#Preview {
    ContentView()
}
