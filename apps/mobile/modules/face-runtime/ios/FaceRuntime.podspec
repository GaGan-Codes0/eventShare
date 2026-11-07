Pod::Spec.new do |s|
  s.name           = 'FaceRuntime'
  s.version        = '1.0.0'
  s.summary        = 'Runs eventShare face models with ONNX Runtime'
  s.license        = 'UNLICENSED'
  s.author         = 'Klyra'
  s.homepage       = 'https://klyra.co.in'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'onnxruntime-objc', '1.30.0'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
