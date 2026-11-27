#import "FaceRuntimeSession.h"

#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include <onnxruntime/onnxruntime_cxx_api.h>

static NSError *FaceRuntimeError(NSString *message) {
  return [NSError errorWithDomain:@"FaceRuntime" code:1 userInfo:@{NSLocalizedDescriptionKey : message}];
}

/// One ONNX Runtime environment for the whole app, made on first use.
static Ort::Env &SharedEnv() {
  // Errors only: the models' harmless graph warnings would otherwise fill the device log on every load.
  static Ort::Env env(ORT_LOGGING_LEVEL_ERROR, "FaceRuntime");
  return env;
}

@implementation FaceRuntimeSession {
  std::unique_ptr<Ort::Session> _session;
  std::vector<std::string> _inputNames;
  std::vector<std::string> _outputNames;
}

- (nullable instancetype)initWithModelPath:(NSString *)path error:(NSError **)error {
  if (!(self = [super init])) return nil;
  try {
    Ort::SessionOptions options;
    options.SetIntraOpNumThreads(2);
    _session = std::make_unique<Ort::Session>(SharedEnv(), path.fileSystemRepresentation, options);
    Ort::AllocatorWithDefaultOptions allocator;
    for (size_t i = 0; i < _session->GetInputCount(); i++) {
      _inputNames.emplace_back(_session->GetInputNameAllocated(i, allocator).get());
    }
    for (size_t i = 0; i < _session->GetOutputCount(); i++) {
      _outputNames.emplace_back(_session->GetOutputNameAllocated(i, allocator).get());
    }
    if (_inputNames.empty()) {
      if (error) *error = FaceRuntimeError(@"The model has no input");
      return nil;
    }
    return self;
  } catch (const Ort::Exception &e) {
    if (error) *error = FaceRuntimeError([NSString stringWithUTF8String:e.what()]);
    return nil;
  }
}

- (nullable NSDictionary<NSString *, NSData *> *)runWithInput:(NSData *)input
                                                        shape:(NSArray<NSNumber *> *)shape
                                                        error:(NSError **)error {
  try {
    std::vector<int64_t> dims;
    size_t count = 1;
    for (NSNumber *n in shape) {
      dims.push_back(n.longLongValue);
      count *= (size_t)n.longLongValue;
    }
    if (count * sizeof(float) != input.length) {
      if (error) *error = FaceRuntimeError(@"The input doesn't match its shape");
      return nil;
    }
    // A private copy: ONNX Runtime reads it during Run, and the caller's bytes may move.
    std::vector<float> values(count);
    memcpy(values.data(), input.bytes, input.length);
    Ort::MemoryInfo memory = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    Ort::Value tensor = Ort::Value::CreateTensor<float>(memory, values.data(), values.size(), dims.data(), dims.size());

    const char *inputName = _inputNames[0].c_str();
    std::vector<const char *> outputNames;
    for (const auto &name : _outputNames) outputNames.push_back(name.c_str());
    std::vector<Ort::Value> outputs =
        _session->Run(Ort::RunOptions{nullptr}, &inputName, &tensor, 1, outputNames.data(), outputNames.size());

    NSMutableDictionary<NSString *, NSData *> *result = [NSMutableDictionary dictionaryWithCapacity:outputs.size()];
    for (size_t i = 0; i < outputs.size(); i++) {
      Ort::TensorTypeAndShapeInfo info = outputs[i].GetTensorTypeAndShapeInfo();
      if (info.GetElementType() != ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT) continue;
      const float *data = outputs[i].GetTensorData<float>();
      result[[NSString stringWithUTF8String:_outputNames[i].c_str()]] =
          [NSData dataWithBytes:data length:info.GetElementCount() * sizeof(float)];
    }
    return result;
  } catch (const Ort::Exception &e) {
    if (error) *error = FaceRuntimeError([NSString stringWithUTF8String:e.what()]);
    return nil;
  }
}

@end
