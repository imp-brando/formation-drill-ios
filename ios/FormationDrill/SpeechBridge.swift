import AVFoundation
import Foundation
import QuartzCore
import Speech

/// Native voice for the web game. Same API the web code (src/part6.js) expects:
///   JS → native: window.FGNative.start(), .stop(), .setGrammar(jsonArrayOfPhrasesAndWords), .version()
///   native → JS: FGN.frame(dBFS, pitchHz, ageMs)   ~every 21 ms, the voice meter
///                FGN.speech(text, isFinal, [alternatives])
///                FGN.state("loading" | "listening" | "denied" | "error", detail)
/// ONE AVAudioEngine input tap feeds both SFSpeechRecognizer and the meter, so the two never fight over
/// the mic. Utterances are cut on ~0.7 s of quiet (from the meter) so each command gets a final result
/// quickly; tasks are also rotated before Apple's ~1 minute limit.
final class SpeechBridge {
    static let injectedJS = """
    (function(){
      if (window.FGNative) return;
      var post = function(m){ try { window.webkit.messageHandlers.fg.postMessage(m); } catch (e) {} };
      window.FGNative = {
        start: function(){ post({cmd: 'start'}); },
        stop: function(){ post({cmd: 'stop'}); },
        setGrammar: function(g){ post({cmd: 'grammar', data: String(g)}); },
        version: function(){ return 'ios-1.0'; }
      };
    })();
    """

    /// Runs JavaScript in the page (set by GameCoordinator). Always called on the main thread.
    var send: ((String) -> Void)?

    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var contextual: [String] = []
    private var wanted = false            // the page asked to listen
    private var running = false
    private var preferOnDevice = true

    // current request: written on main, appended to from the audio thread
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?

    // tasks by generation; only the newest sends partial results
    private var gen = 0
    private var tasks: [Int: SFSpeechRecognitionTask] = [:]
    private var lastPartial: [Int: String] = [:]
    private var finalSent: Set<Int> = []
    private var taskStart: CFTimeInterval = 0
    private var quickFails = 0

    // utterance cutting (main thread)
    private var inUtterance = false
    private var lastVoice: CFTimeInterval = 0

    // meter state (audio thread only)
    private var noiseFloor: Float = -60
    private let hop = 1024

    private var observers: [NSObjectProtocol] = []

    init() {
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let self = self,
                  let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            if type == .began { self.teardownEngine() } else { self.resumeIfWanted() }
        })
        observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            self?.teardownEngine(); self?.resumeIfWanted()
        })
    }
    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }

    // MARK: API from the page

    func setGrammar(json: String) {
        guard let data = json.data(using: .utf8),
              let list = (try? JSONSerialization.jsonObject(with: data)) as? [String] else { return }
        let items = list.filter { !$0.contains("[") && !$0.isEmpty }
        // whole phrases first (they help most), then single words; Apple uses up to ~100
        let phrases = items.filter { $0.contains(" ") }, words = items.filter { !$0.contains(" ") }
        var seen = Set<String>()
        contextual = Array((phrases + words).filter { seen.insert($0).inserted }.prefix(100))
    }

    func start() {
        wanted = true
        if running { return }
        js("FGN.state('loading')")
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { self.denied(); return }
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async { granted ? self.startEngine() : self.denied() }
                }
            }
        }
    }

    func stop() {
        wanted = false
        teardownEngine()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// App went to the background: release the mic but remember the page wants it.
    func pause() { teardownEngine() }
    func resumeIfWanted() { if wanted && !running { startEngine() } }

    // MARK: Engine

    private func denied() {
        wanted = false
        js("FGN.state('denied')")
    }

    private func fail(_ msg: String) {
        let esc = msg.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        js("FGN.state('error','\(esc)')")
    }

    private func startEngine() {
        guard wanted, !running else { return }
        guard let rec = recognizer, rec.isAvailable else { fail("Speech recognition isn't available right now"); return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .mixWithOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            fail("Couldn't open the microphone (\(error.localizedDescription))"); return
        }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { fail("No microphone found"); return }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.process(buffer)
        }
        quickFails = 0
        newTask()
        engine.prepare()
        do { try engine.start() } catch {
            input.removeTap(onBus: 0)
            fail("Couldn't start the microphone (\(error.localizedDescription))"); return
        }
        running = true
        js("FGN.state('listening')")
    }

    private func teardownEngine() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        lock.lock(); let req = request; request = nil; lock.unlock()
        req?.endAudio()
        tasks.values.forEach { $0.cancel() }
        tasks.removeAll(); lastPartial.removeAll(); finalSent.removeAll()
        inUtterance = false
        running = false
    }

    // MARK: Recognition tasks

    private func newTask() {
        guard let rec = recognizer else { return }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .search                                   // short commands, not dictation
        req.contextualStrings = contextual
        if preferOnDevice && rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
        if #available(iOS 16.0, *) { req.addsPunctuation = false }
        gen += 1
        let g = gen
        lock.lock(); request = req; lock.unlock()
        taskStart = CACurrentMediaTime()
        tasks[g] = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async { self?.handle(result: result, error: error, gen: g) }
        }
    }

    /// End the current utterance (its final result arrives shortly) and keep listening on a new task.
    private func finishUtterance() {
        lock.lock(); let req = request; request = nil; lock.unlock()
        req?.endAudio()
        if running { newTask() }
    }

    private func handle(result: SFSpeechRecognitionResult?, error: Error?, gen g: Int) {
        if let r = result {
            let texts = r.transcriptions.map { Self.clean($0.formattedString) }.filter { !$0.isEmpty }
            var seen = Set<String>()
            let uniq = texts.filter { seen.insert($0).inserted }
            if let top = uniq.first {
                let alts = Array(uniq.dropFirst().prefix(4))
                if r.isFinal {
                    if !finalSent.contains(g) { finalSent.insert(g); emit(top, final: true, alts: alts) }
                } else if g == gen, lastPartial[g] != top {
                    lastPartial[g] = top
                    emit(top, final: false, alts: alts)
                }
            }
            if r.isFinal { quickFails = 0; done(g) }
        }
        if error != nil {
            // ended without a final (no speech, cancelled, service hiccup): close any open partial
            if let p = lastPartial[g], !finalSent.contains(g) { finalSent.insert(g); emit(p, final: true, alts: []) }
            let lived = CACurrentMediaTime() - taskStart
            done(g)
            guard g == gen, running else { return }
            // the live task died: start another, backing off if it keeps dying at once
            if lived < 0.5 {
                quickFails += 1
                if quickFails == 2 { preferOnDevice = false }    // e.g. the on-device model isn't downloaded
                if quickFails >= 6 { fail("Speech recognition keeps stopping. Check your connection, then tap FALL IN."); teardownEngine(); return }
            }
            let delay = lived < 0.5 ? min(2.0, 0.25 * Double(quickFails)) : 0
            lock.lock(); request = nil; lock.unlock()
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self, self.running, g == self.gen else { return }
                self.newTask()
            }
        }
    }

    private func done(_ g: Int) {
        tasks[g] = nil
        lastPartial[g] = nil
        if finalSent.count > 64 { finalSent = finalSent.filter { $0 > g - 32 } }
    }

    private func emit(_ text: String, final: Bool, alts: [String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: [text, alts]),
              let json = String(data: data, encoding: .utf8) else { return }
        js("(function(a){FGN.speech(a[0],\(final ? "true" : "false"),a[1]);})(\(json))")
    }

    static func clean(_ s: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " '"))
        let mapped = s.lowercased().unicodeScalars.map { allowed.contains($0) ? Character($0) : " " }
        return String(mapped).split(separator: " ").joined(separator: " ")
    }

    // MARK: Audio thread: feed recognition, measure level + pitch

    private func process(_ buffer: AVAudioPCMBuffer) {
        lock.lock(); request?.append(buffer); lock.unlock()
        guard let ch = buffer.floatChannelData?[0] else { return }
        let n = Int(buffer.frameLength)
        if n == 0 { return }
        let sr = Float(buffer.format.sampleRate)
        var calls = ""
        var anyVoice = false
        var start = 0
        while start < n {                                       // iOS may hand over ~100 ms at once: one frame per ~21 ms
            let len = min(hop, n - start)
            var sum: Float = 0
            for i in start..<(start + len) { sum += ch[i] * ch[i] }
            let db = 20 * log10f(sqrtf(sum / Float(len)) + 1e-9)
            let hz: Float = db > noiseFloor + 6 ? Self.pitch(ch + start, len, sr) : 0
            noiseFloor = db < noiseFloor ? noiseFloor + (db - noiseFloor) * 0.3 : noiseFloor + (db - noiseFloor) * 0.004
            noiseFloor = min(max(noiseFloor, -90), -35)
            if db - noiseFloor > 9 { anyVoice = true }
            let ageMs = Double(n - start - len) / Double(sr) * 1000 + Double(len) / Double(sr) * 500
            calls += String(format: "FGN.frame(%.1f,%.1f,%.0f);", Double(db), Double(hz), ageMs)
            start += len
        }
        let t = CACurrentMediaTime()
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.running else { return }
            self.js(calls)
            self.segment(voice: anyVoice, t: t)
        }
    }

    private func segment(voice: Bool, t: CFTimeInterval) {
        if voice { inUtterance = true; lastVoice = t }
        if inUtterance && t - lastVoice > 0.7 { inUtterance = false; finishUtterance() }
        else if !inUtterance && t - taskStart > 50 { finishUtterance() }   // stay under Apple's ~1 min task limit
    }

    /// Normalised autocorrelation on a 2x-decimated buffer, 70–450 Hz (same method as the web meter). 0 = unvoiced.
    static func pitch(_ buf: UnsafePointer<Float>, _ count: Int, _ sr: Float) -> Float {
        let n = count / 2
        if n < 64 { return 0 }
        var x = [Float](repeating: 0, count: n)
        for i in 0..<n { x[i] = (buf[2 * i] + buf[2 * i + 1]) * 0.5 }
        let fs = sr / 2
        let minLag = Int(fs / 450), maxLag = min(Int(fs / 70), n / 2)
        let m = n - maxLag
        if m <= 0 || minLag >= maxLag { return 0 }
        var e0: Float = 0
        for i in 0..<m { e0 += x[i] * x[i] }
        var r = [Float](repeating: 0, count: maxLag + 2)
        var best: Float = 0, bestLag = 0, prev: Float = 1, rising = false
        for lag in minLag...maxLag {
            var c: Float = 0, e1: Float = 0
            for i in 0..<m { c += x[i] * x[i + lag]; e1 += x[i + lag] * x[i + lag] }
            let v = c / sqrtf(e0 * e1 + 1e-12)
            r[lag] = v
            if v > prev { rising = true }
            if rising && v > best { best = v; bestLag = lag }
            prev = v
        }
        if best < 0.5 || bestLag == 0 { return 0 }
        let a = bestLag > minLag ? r[bestLag - 1] : best
        let c = bestLag < maxLag ? r[bestLag + 1] : best
        let den = (a - 2 * best + c) == 0 ? 1 : (a - 2 * best + c)
        let p = max(-0.5, min(0.5, (a - c) / (2 * den)))
        return fs / (Float(bestLag) + p)
    }

    private func js(_ s: String) {
        if Thread.isMainThread { send?(s) } else { DispatchQueue.main.async { self.send?(s) } }
    }
}
