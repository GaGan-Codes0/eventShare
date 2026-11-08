package co.klyra.eventshare.faceruntime

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Loads ONNX models and runs them on one float32 input. Used for Find my photos (YuNet + SFace). */
class FaceRuntimeModule : Module() {
  private val env: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }
  private val sessions = mutableMapOf<Int, OrtSession>()
  private var nextId = 1

  override fun definition() = ModuleDefinition {
    Name("FaceRuntime")

    AsyncFunction("load") { path: String ->
      val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2) }
      val session = env.createSession(path, options)
      synchronized(sessions) {
        val id = nextId++
        sessions[id] = session
        id
      }
    }

    // The input arrives as bytes (copied by Expo on the JS thread, so safe to use here off it).
    AsyncFunction("run") { id: Int, input: ByteArray, shape: List<Int> ->
      val floats = ByteBuffer.wrap(input).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
      val session = synchronized(sessions) { sessions[id] } ?: throw CodedException("NoModel", "That model isn't loaded", null)
      val inputName = session.inputNames.first()
      OnnxTensor.createTensor(env, floats, shape.map { it.toLong() }.toLongArray()).use { tensor ->
        session.run(mapOf(inputName to tensor)).use { result ->
          result.associate { (name, value) ->
            val out = (value as OnnxTensor).floatBuffer
            val bytes = ByteBuffer.allocate(out.remaining() * 4).order(ByteOrder.LITTLE_ENDIAN)
            bytes.asFloatBuffer().put(out)
            name to bytes.array()
          }
        }
      }
    }
  }
}
