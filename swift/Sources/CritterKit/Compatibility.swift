import SwiftUI

// Earlier versions of this package were called PipMascot and used `Pip` names.
// These keep that code compiling; Xcode offers a one-click fix to the new names.

@available(*, deprecated, renamed: "Critter")
public typealias Pip = Critter
@available(*, deprecated, renamed: "CritterCorner")
public typealias PipCorner = CritterCorner
@available(*, deprecated, renamed: "CritterMood")
public typealias PipMood = CritterMood
@available(*, deprecated, renamed: "CritterEvent")
public typealias PipEvent = CritterEvent
@available(*, deprecated, renamed: "CritterConfiguration")
public typealias PipConfiguration = CritterConfiguration
@available(*, deprecated, renamed: "CritterSeason")
public typealias PipSeason = CritterSeason

public extension View {
    @available(*, deprecated, renamed: "critterTarget(_:)")
    func pipTarget(_ id: String) -> some View { critterTarget(id) }

    @available(*, deprecated, renamed: "critterMascot(_:)")
    func pipMascot(_ configuration: Critter.Configuration = Critter.Configuration()) -> some View { critterMascot(configuration) }
}
