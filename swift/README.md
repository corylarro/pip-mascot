# CritterKit for iOS

An animated mascot that lives on top of your iPhone app and reacts to what's happening: it watches people type, cheers when things work, looks worried when they don't, and walks over to point at things. Works with SwiftUI and UIKit on iOS 15 or later.

Make your mascot at [critterkit.com](https://www.critterkit.com), then copy its id.

## Install

In Xcode: **File → Add Package Dependencies…**, paste

```
https://github.com/corylarro/CritterKit
```

and add `CritterKit` to your app target.

## Use it

```swift
import CritterKit

// SwiftUI: on your root view
ContentView().critterMascot(.init(mascotID: "your-mascot-id"))

// UIKit: once your window is showing
Critter.start(.init(mascotID: "your-mascot-id"))
```

Name views so the mascot can walk to them, then point or celebrate:

```swift
TextField("Email", text: $email).critterTarget("email")

Critter.point(at: "email", say: "That email looks off.")
Critter.celebrate(at: "streak", say: "7 days in a row!")

// UIKit views work directly
Critter.point(at: emailField, say: "That email looks off.")
```

React to network calls (thinks while waiting, then cheers or looks worried):

```swift
try await Critter.watch(success: "Saved!") {
    try await api.save(note)
}
```

Celebrate the moments only your app knows about:

```swift
Critter.moment(.firstPurchase)
Critter.moment(.streak(days: 7))
Critter.moment(.levelUp(5))
```

Play a custom moment (build one at [critterkit.com/studio](https://www.critterkit.com/studio)), including custom poses you painted for your mascot:

```swift
Critter.play([["do": "pose", "name": "snowboarding"], ["do": "spin"], ["do": "say", "text": "Level {level}!"]],
             values: ["level": level])
```

Walk people through a screen:

```swift
Critter.tour([("plan", "Pick a plan"), ("start", "Then tap here")], done: "You're all set!")
```

Other calls: `Critter.react(.love)`, `Critter.say("Hi!")`, `Critter.set(.thinking)`, `Critter.home()`, `Critter.hide()`, `Critter.show()`, `Critter.stop()`, `Critter.season(.snow)`.

Options for `Critter.Configuration`: `mascotID`, `corner` (`.bottomRight`, `.bottomLeft`, `.topRight`, `.topLeft`), `offset`, `size`, `greets`, `greeting`, `autopilot`, `hideable`, `sleepAfter`, `seasonal`.

Events:

```swift
Critter.onEvent = { event in print(event) }   // .ready, .tapped, .hidden, .shown, .failedToLoad, .stateChanged
```

The mascot is drawn by the Critterkit engine, which loads from critterkit.com, so your app needs a network connection the first time it shows the mascot.

Full docs: [critterkit.com/docs](https://www.critterkit.com/docs#ios)

Critterkit is a product of Zero to Build LLC.
