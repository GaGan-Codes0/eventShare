import ExpoModulesCore

/// Loads ONNX models and runs them on one float32 input. Used for Find my photos (YuNet + SFace).
/// ONNX Runtime itself is reached through FaceRuntimeSession (Objective-C++).
public class FaceRuntimeModule: Module {
  private var sessions: [Int: FaceRuntimeSession] = [:]
  private var nextId = 1
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("FaceRuntime")

    AsyncFunction("load") { (path: String) -> Int in
      let session = try FaceRuntimeSession(modelPath: path)
      self.lock.lock()
      defer { self.lock.unlock() }
      let id = self.nextId
      self.nextId += 1
      self.sessions[id] = session
      return id
    }

    // The input arrives as bytes (copied by Expo on the JS thread, so safe to use here off it).
    AsyncFunction("run") { (id: Int, input: Data, shape: [Int]) -> [String: Data] in
      self.lock.lock()
      let session = self.sessions[id]
      self.lock.unlock()
      guard let session else { throw Exception(name: "NoModel", description: "That model isn't loaded") }
      return try session.run(input: input, shape: shape.map { NSNumber(value: $0) })
    }
  }
}
