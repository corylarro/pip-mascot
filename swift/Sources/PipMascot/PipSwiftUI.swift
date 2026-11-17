import SwiftUI

/// Where SwiftUI views marked with `.pipTarget("id")` are on screen.
enum PipTargets {
    static var frames: [String: CGRect] = [:]
}

private struct PipTargetReader: View {
    let id: String

    var body: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear { PipTargets.frames[id] = geo.frame(in: .global) }
                .onChange(of: geo.frame(in: .global)) { frame in PipTargets.frames[id] = frame }
        }
    }
}

public extension View {
    /// Name a view so Pip can walk to it: `Pip.point(at: "email")`, `Pip.celebrate(at: "streak")`.
    func pipTarget(_ id: String) -> some View {
        background(PipTargetReader(id: id))
    }

    /// Start Pip when this view appears. Put it on your root view.
    func pipMascot(_ configuration: Pip.Configuration = Pip.Configuration()) -> some View {
        onAppear {
            Task { @MainActor in Pip.start(configuration) }
        }
    }
}
