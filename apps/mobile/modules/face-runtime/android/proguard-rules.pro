# ONNX Runtime's native code finds its Java classes by name (JNI), so release
# builds must not rename or remove them, or the app crashes on the first run().
-keep class ai.onnxruntime.** { *; }
-keepclasseswithmembernames class ai.onnxruntime.** { native <methods>; }
