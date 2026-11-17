import SwiftUI
import PipMascot

@main
struct PipDemoApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .pipMascot(PipDemoSettings.configuration)
        }
    }
}
