import SwiftUI
import CritterKit

@main
struct CritterDemoApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .critterMascot(CritterDemoSettings.configuration)
        }
    }
}
