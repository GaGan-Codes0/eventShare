#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// One loaded ONNX model (ONNX Runtime's C++ API behind a plain Objective-C face, for Swift).
@interface FaceRuntimeSession : NSObject

- (nullable instancetype)initWithModelPath:(NSString *)path error:(NSError **)error NS_SWIFT_NAME(init(modelPath:));

/// Runs the model on one float32 tensor; every output comes back as its float32 bytes, by name.
- (nullable NSDictionary<NSString *, NSData *> *)runWithInput:(NSData *)input
                                                        shape:(NSArray<NSNumber *> *)shape
                                                        error:(NSError **)error NS_SWIFT_NAME(run(input:shape:));

- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
