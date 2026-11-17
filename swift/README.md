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

The demo is **Stillwater**, a small meditation app. Long-press the Stillwater logo (or your initial on the home screen) for the demo controls: move Pip, make it react, simulate a server outage, hide it, or restart the demo.

- **Sign up**
  - Tap **Create account** with everything empty. Pip walks to the name field and points at it.
  - Tap into a field: Pip sits on top of the keyboard and watches you type. On the password field it covers its eyes.
  - Fill everything in: Pip thinks, cheers, and the home screen slides in.
  - Turn on **Simulate a server outage** first and Pip looks worried instead.
- **Home**
  - Tap a feeling: Pip reacts (Stressed sends Pip over to tonight's session).
  - **Begin session**: breathe with Pip for two breaths. When it ends, the streak goes up and Pip celebrates on the streak card.
  - Restart the demo, then **Take a rest day**: Pip comes over and is reassuring.
- Tap Pip: a small × appears. Tap it to hide Pip; a smiley button brings it back.
- Leave the app for 20+ seconds, then come back: Pip says welcome back.

The demo needs iOS 17 or later (Pip itself works on iOS 15). For a nicer home screen, set the app's **Display Name** to `Stillwater` (target → General) and drag `Demo/AppIcon-1024.png` onto **AppIcon** in Assets.

## Put it on your iPhone with TestFlight

Use this when your Mac can't run the Xcode version your phone needs. Xcode Cloud builds the app on Apple's Macs and sends it to TestFlight.

1. **Join the Apple Developer Program** at developer.apple.com/programs. Approval can take a day or two.
2. **Keep the package inside your project.** Move the `PipMascot` folder into your project's folder (next to the `.xcodeproj`). In Xcode, remove the old package (project → Package Dependencies → −), then File → Add Package Dependencies… → Add Local… and pick the moved folder. Xcode Cloud only sees what's in your repository.
3. **Get the project ready.**
   - Target → **Signing & Capabilities**: tick "Automatically manage signing", pick your developer team, and set a bundle identifier such as `com.yourname.stillwater`.
   - Target → **General**: set Minimum Deployments to iOS 17 or later. Version `1.0`, Build `1`.
   - Add the app icon (see above). TestFlight rejects builds without one.
   - Target → **Info**: add the key **App Uses Non-Exempt Encryption** and set it to **NO**. This skips an export question on every build.
4. **Put the project on GitHub.** Source Control navigator (⌘2) → Repositories → right-click **Remotes** → **New "…" Remote**, sign in to GitHub, make it private, then Integrate → Commit and Push.
5. **Create the workflow.** Integrate → **Create Workflow…** (or Product → Xcode Cloud → Create Workflow), pick your app and follow the steps: grant access to GitHub, and let Xcode Cloud create the app in App Store Connect if it asks.
6. **Edit the workflow** before the first build:
   - **Environment:** Xcode version = Latest Release.
   - **Archive action:** iOS, Deployment Preparation = **TestFlight (Internal Testing Only)**.
   - **Post-actions:** add **TestFlight Internal Testing** and choose a group that includes you.
7. **Start a build.** It takes roughly 10 to 20 minutes. If it fails, open the build in Xcode's Report navigator (⌘9) and send over the errors.
8. **Install it.** Get the **TestFlight** app on your iPhone, sign in with the same Apple ID, and Stillwater shows up ready to install. Every push to GitHub builds a new version.

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
