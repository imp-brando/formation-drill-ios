import SwiftUI

/// Formation Drill for iPhone and iPad: the web game (GitHub Pages, with a bundled offline copy)
/// in a WKWebView, plus native speech recognition and a voice meter (SpeechBridge).
@main
struct FormationDrillApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color(red: 0.184, green: 0.204, blue: 0.078).ignoresSafeArea())
                .preferredColorScheme(.dark)
        }
    }
}
