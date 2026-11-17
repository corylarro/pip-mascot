# Pip for iOS (Swift)

An animated mascot that lives on top of your app and reacts to what's happening. Requires iOS 15 or later.

## Set up the test app (about 10 minutes)

1. **Unzip** `PipMascot.zip` somewhere easy to find, such as your Documents folder. You get a folder called `PipMascot`.
2. **Make a new app in Xcode.** File → New → Project → iOS → App. Name it `PipDemo`, choose SwiftUI for the interface and Swift for the language.
3. **Add the package.** File → Add Package Dependencies… → click **Add Local…** at the bottom left → pick the `PipMascot` folder → **Add Package**. In the next window, make sure `PipMascot` is ticked for the `PipDemo` target, then **Add Package**.
4. **Copy in the demo.**
   - Open `PipMascot/Demo/ContentView.swift`, copy everything, and paste it over your project's `ContentView.swift`.
   - Open your project's `PipDemoApp.swift` and replace it with `PipMascot/Demo/PipDemoApp.swift`.
5. **Run it.** Pick an iPhone simulator at the top of Xcode (any recent iPhone) and press ⌘R.

## What to try

- Pip walks in and says hi in the bottom-right corner.
- **Sign up tab**
  - Tap **Create account** with everything empty. Pip walks to the Name field and points at it.
  - Tap into a field: the keyboard opens and Pip sits on top of it, watching you type.
  - Tap the password field: Pip covers its eyes.
  - Fill everything in and sign up: Pip thinks, then cheers.
  - Turn on **Pretend the server is down** and sign up again: Pip looks worried.
- **Streak tab**
  - **Finish today's session**: Pip walks to the streak card and celebrates.
  - **Reset**, then **Skip today**: Pip comes over and is reassuring.
- **Smiley menu (top right)**: move Pip to another corner, make it react, hide it and show it.
- Tap Pip: a small × appears. Tap it to hide Pip; a smiley button brings it back.
- Send the app to the background for 20+ seconds, then come back: Pip says welcome back.
- Take a screenshot (Device → Trigger Screenshot in the simulator).
- Scroll and tap around the rest of the app: everything outside Pip should work normally.

## If something goes wrong

- **Build errors:** open the Issue navigator (⌘5), copy the red errors and send them over.
- **Pip doesn't appear:** check the Xcode console (⌘⇧Y) for messages.
- **Seeing inside Pip:** in Safari on your Mac, turn on Settings → Advanced → "Show features for web developers". Then use Develop → Simulator → `pip-mascot.vercel.app` to open Pip's console while the app runs.
- **Painted mascot doesn't load:** set `mascotID` to `nil` in `PipDemoSettings` to try the drawn mascot. If that works, it's a network issue.

## Using Pip in your own app

```swift
import PipMascot

// SwiftUI: on your root view
ContentView().pipMascot(.init(mascotID: "your-mascot-id"))

// UIKit: once your window is showing
Pip.start(.init(mascotID: "your-mascot-id"))
```

Mark views so Pip can find them, then point or celebrate:

```swift
TextField("Email", text: $email).pipTarget("email")
Pip.point(at: "email", say: "That email looks off.")
Pip.celebrate(at: "streak", say: "7 days in a row!")

// UIKit views work directly
Pip.point(at: emailField, say: "That email looks off.")
```

Let Pip react to network calls:

```swift
try await Pip.watch(success: "Saved!") {
    try await api.save(note)
}
```

Other calls: `Pip.react(.love)`, `Pip.say("Hi!")`, `Pip.set(.thinking)`, `Pip.home()`, `Pip.hide()`, `Pip.show()`, `Pip.stop()`.

Options for `Pip.Configuration`: `mascotID`, `corner` (`.bottomRight`, `.bottomLeft`, `.topRight`, `.topLeft`), `offset`, `size`, `greets`, `greeting`, `autopilot`, `hideable`, `sleepAfter`.

Listen for events:

```swift
Pip.onEvent = { event in print(event) }   // .ready, .tapped, .hidden, .shown, .failedToLoad, .stateChanged
```
