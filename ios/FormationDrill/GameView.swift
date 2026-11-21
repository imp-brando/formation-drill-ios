import SwiftUI
import UIKit
import WebKit

/// The game page. Loads the live site (edits go live without an app update); when there's no signal
/// or the site can't be reached, it loads the copy bundled in the app (Web/index.html).
struct GameView: UIViewRepresentable {
    static let siteURL = URL(string: "https://imp-brando.github.io/formation-drill-ios/")!

    func makeCoordinator() -> GameCoordinator { GameCoordinator() }
    func makeUIView(context: Context) -> WKWebView { context.coordinator.makeWebView() }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: GameCoordinator) { coordinator.teardown() }
}

/// Avoids the retain cycle WKUserContentController.add(_:name:) would create.
final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

@MainActor
final class GameCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private let speech = SpeechBridge()
    private var usingBundled = false
    private var observers: [NSObjectProtocol] = []

    func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []      // step ticks and chimes play without a tap
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: SpeechBridge.injectedJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.add(WeakScriptHandler(self), name: "fg")
        config.userContentController = content

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.isOpaque = false
        wv.backgroundColor = UIColor(red: 0.184, green: 0.204, blue: 0.078, alpha: 1)
        wv.scrollView.backgroundColor = wv.backgroundColor
        wv.scrollView.bounces = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never      // the page handles the notch with env(safe-area-inset-*)
        wv.allowsLinkPreview = false
        if #available(iOS 16.4, *) { wv.isInspectable = true }     // Safari → Develop menu, for debugging
        webView = wv

        speech.send = { [weak wv] js in wv?.evaluateJavaScript(js, completionHandler: nil) }

        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.speech.pause() }
        })
        observers.append(nc.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.speech.resumeIfWanted() }
        })

        loadRemote()
        return wv
    }

    func teardown() {
        speech.stop()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }

    private func loadRemote() {
        let req = URLRequest(url: GameView.siteURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 8)
        webView?.load(req)
    }

    private func loadBundled() {
        guard !usingBundled,
              let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else { return }
        usingBundled = true
        webView?.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // MARK: JS → native (window.FGNative.start/stop/setGrammar)
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        switch cmd {
        case "start": speech.start()
        case "stop": speech.stop()
        case "grammar": if let json = body["data"] as? String { speech.setGrammar(json: json) }
        default: break
        }
    }

    // MARK: Navigation: fall back to the bundled copy when the site can't be reached
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        speech.stop()                                    // a new page: it will ask for the mic again
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadBundled()
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if webView.url == nil { loadBundled() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        if navigationResponse.isForMainFrame, !usingBundled,
           let http = navigationResponse.response as? HTTPURLResponse, http.statusCode >= 400 {
            loadBundled()
            return .cancel
        }
        return .allow
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        speech.stop()
        webView.reload()
    }

    // MARK: JS alert / confirm ("Forget everything learned from your voice?")
    private func present(_ alert: UIAlertController) -> Bool {
        guard var top = webView?.window?.rootViewController else { return false }
        while let next = top.presentedViewController { top = next }
        top.present(alert, animated: true)
        return true
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume() })
            if !present(a) { done.resume() }
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in done.resume(returning: false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume(returning: true) })
            if !present(a) { done.resume(returning: false) }
        }
    }
}
