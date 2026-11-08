import { requireNativeModule } from 'expo-modules-core';

/**
 * A thin bridge to Microsoft's ONNX Runtime (onnxruntime-objc on iOS, onnxruntime-android):
 * load a model file, run it on one float tensor, get every output back as float32 bytes.
 */
type Native = {
  load(path: string): Promise<number>;
  run(session: number, input: Uint8Array, shape: number[]): Promise<Record<string, Uint8Array>>;
};

const native = requireNativeModule<Native>('FaceRuntime');

export type Session = { run(input: Float32Array, shape: number[]): Promise<Record<string, Float32Array>> };

export async function loadModel(path: string): Promise<Session> {
  const id = await native.load(path.replace(/^file:\/\//, ''));
  return {
    async run(input, shape) {
      // Handed over as bytes: the native side copies them before leaving the JS thread.
      const out = await native.run(id, new Uint8Array(input.buffer, input.byteOffset, input.byteLength), shape);
      const floats: Record<string, Float32Array> = {};
      for (const [name, bytes] of Object.entries(out)) {
        // Copied so the floats start on a 4-byte boundary whatever the bytes' offset.
        floats[name] = new Float32Array(bytes.slice().buffer);
      }
      return floats;
    },
  };
}
