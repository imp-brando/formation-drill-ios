# Formation Drill (iOS / Safari edition)

Voice-controlled Drill & Ceremony practice game for iPhone and iPad. Call drill commands with proper
inflection to march a four-file formation: Fall in, Cover, Recover, Forward MARCH, column movements, flanks,
rear march, counter column and more, timed to PICAA.

**Play in Safari (iPhone / iPad):** https://imp-brando.github.io/formation-drill-ios/

This is the iOS / Safari edition: one HTML file, no install. It uses Safari's built-in speech recognition and
works offline after the first visit (service worker). In Safari tap **Share → Add to Home Screen** to get a
full-screen app icon.

**Requirements:** iOS / iPadOS 14.5 or later, **Safari**, and **Siri and Dictation turned on**
(Settings → General → Keyboard → Enable Dictation). Allow the microphone when asked.

## Safari limitations (and what the game does about them)

- Safari sends speech to Apple's servers, so voice commands need a connection (the game itself works offline).
- Safari ends listening sessions quickly and its continuous mode is unreliable. The game uses short sessions and
  restarts them at once, backs off on network errors, and shows **🎙 Tap to resume listening** if Safari stops
  restarting (Safari sometimes wants a fresh tap).
- Speech recognition and the voice meter may not share the iPhone mic. The game starts with speech only, then
  checks whether the meter can run alongside it. If it can't, the meter turns off: commands still work, but the
  inflection check is skipped and voice burst uses the words.
- Other iPhone browsers (Chrome, Firefox, Edge) and apps' built-in browsers (Instagram, Facebook, Gmail…)
  have no speech recognition. Open the link in Safari.
- "Hold to talk" is there if commands stop being heard.

## Native iOS app (ios/)

A SwiftUI app with a `WKWebView` that loads the Pages site above, falling back to a copy bundled in the app when
there's no signal. Voice runs natively:

- `SFSpeechRecognizer` (on the device when the iPhone supports it), biased with the drill word list the web
  game sends (`contextualStrings`).
- One `AVAudioEngine` mic tap feeds both recognition and the voice meter (loudness and pitch), so there's no mic
  sharing problem and the inflection check always works.
- Same bridge as the web code expects (`window.FGNative` → `FGN.frame / FGN.speech / FGN.state`), see
  `src/part6.js`. The web game needs no changes to run inside the app.

**Build and run it (Mac with Xcode 15 or later):**

1. Open `ios/FormationDrill.xcodeproj` in Xcode (or regenerate it: `brew install xcodegen && cd ios && xcodegen generate`).
2. **Simulator:** pick an iPhone simulator and press Run. (The simulator's mic works through your Mac's mic.)
3. **Your own iPhone, free:** Xcode → Settings → Accounts → add your Apple ID. In the target's
   *Signing & Capabilities* pick your Personal Team and change the bundle identifier to something unique.
   Plug in the iPhone, turn on Developer Mode (Settings → Privacy & Security), and Run. Free-account apps
   expire after 7 days; run again from Xcode to renew.
4. **Share with your peers:** with an Apple Developer Program account ($99/year), Product → Archive →
   Distribute App → TestFlight, then invite testers by email or a public link. The same account is needed for
   the App Store.

GitHub Actions builds the app for the simulator on every change to `ios/` (no signing) as a compile check;
see the Actions tab.

## Develop

- Source is in `src/`; `./build.sh` concatenates it into `index.html` (what Pages serves) and refreshes the
  offline copy in `ios/FormationDrill/Web/`.
- `sw.js`: offline cache (network first, cached copy with no signal). `manifest.webmanifest` and `icons/`:
  Add to Home Screen.
- Tests: `node tests/<name>.js` (puppeteer-core + Chrome), and the iPhone / WebKit test
  `node tests/ios-webkit.js` (Playwright WebKit, iPhone 15 viewport; `npx playwright install webkit`).
- Voiced cadences are switched off (`CADENCES_ENABLED=false` in `src/part5.js`).
