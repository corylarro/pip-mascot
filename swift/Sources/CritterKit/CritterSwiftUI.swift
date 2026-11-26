import SwiftUI

/// Where SwiftUI views marked with `.critterTarget("id")` are on screen.
enum CritterTargets {
    static var frames: [String: CGRect] = [:]
}

private struct CritterTargetReader: View {
    let id: String

    var body: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear { CritterTargets.frames[id] = geo.frame(in: .global) }
                .onChange(of: geo.frame(in: .global)) { frame in CritterTargets.frames[id] = frame }
        }
    }
}

public extension View {
    /// Name a view so Critter can walk to it: `Critter.point(at: "email")`, `Critter.celebrate(at: "streak")`.
    func critterTarget(_ id: String) -> some View {
        background(CritterTargetReader(id: id))
    }

    /// Start Critter when this view appears. Put it on your root view.
    func critterMascot(_ configuration: Critter.Configuration = Critter.Configuration()) -> some View {
        onAppear {
            Task { @MainActor in Critter.start(configuration) }
        }
    }
}
