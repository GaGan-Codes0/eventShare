import ExpoModulesCore
import onnxruntime_objc

/// Loads ONNX models and runs them on one float32 input. Used for Find my photos (YuNet + SFace).
public class FaceRuntimeModule: Module {
  private var env: ORTEnv?
  private var sessions: [Int: ORTSession] = [:]
  private var nextId = 1
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("FaceRuntime")

    AsyncFunction("load") { (path: String) -> Int in
      self.lock.lock()
      defer { self.lock.unlock() }
      if self.env == nil { self.env = try ORTEnv(loggingLevel: .warning) }
      let options = try ORTSessionOptions()
      try options.setIntraOpNumThreads(2)
      let session = try ORTSession(env: self.env!, modelPath: path, sessionOptions: options)
      let id = self.nextId
      self.nextId += 1
      self.sessions[id] = session
      return id
    }

    // The input arrives as bytes (copied by Expo on the JS thread, so safe to use here off it).
    AsyncFunction("run") { (id: Int, input: Data, shape: [Int]) -> [String: Data] in
      let bytes = NSMutableData(data: input)
      self.lock.lock()
      let session = self.sessions[id]
      self.lock.unlock()
      guard let session else { throw Exception(name: "NoModel", description: "That model isn't loaded") }
      let tensor = try ORTValue(tensorData: bytes, elementType: .float, shape: shape.map { NSNumber(value: $0) })
      guard let inputName = try session.inputNames().first else {
        throw Exception(name: "BadModel", description: "The model has no input")
      }
      let outputs = try session.run(withInputs: [inputName: tensor], outputNames: Set(try session.outputNames()), runOptions: nil)
      var result: [String: Data] = [:]
      for (name, value) in outputs {
        result[name] = try value.tensorData() as Data
      }
      return result
    }
  }
}
