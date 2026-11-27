require 'digest'
require 'fileutils'

# ONNX Runtime for iPhone, straight from Microsoft's own NuGet package.
#
# The CocoaPods pods (onnxruntime-c / onnxruntime-objc) download from download.onnxruntime.ai, which
# has served a certificate for another host (and then 404s) since Nov 2026, so `pod install` fails
# with them. The same framework ships in Microsoft's NuGet package, which is checked here against
# the SHA-512 NuGet publishes for it before anything is used. It's unpacked once into vendor/
# (gitignored) and reused. To move to a newer version, change both values below; the hash is the
# package's `packageHash` in NuGet's catalog (or `openssl dgst -sha512 -binary x.nupkg | base64`).
ort_version = '1.30.0'
ort_sha512 = 'xTgo+P2WWI1BrKQb91+G8YR1s/SFH07xZuc42kdgS2I6GLGOAKnMVhFqCk7nmce6L6ajho8wAcqixYAiwfE79g=='

vendor = File.join(__dir__, 'vendor')
framework = File.join(vendor, 'onnxruntime.xcframework')
stamp = File.join(vendor, "onnxruntime-#{ort_version}.ok")
unless File.exist?(stamp)
  FileUtils.rm_rf(vendor)
  FileUtils.mkdir_p(vendor)
  nupkg = File.join(vendor, 'onnxruntime.nupkg')
  url = "https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime/#{ort_version}/microsoft.ml.onnxruntime.#{ort_version}.nupkg"
  Pod::UI.puts "[FaceRuntime] Downloading ONNX Runtime #{ort_version} from NuGet (about 150 MB, once)"
  system('curl', '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--output', nupkg, url) ||
    raise("[FaceRuntime] Couldn't download #{url}")
  actual = Digest::SHA512.file(nupkg).base64digest
  unless actual == ort_sha512
    FileUtils.rm_rf(vendor)
    raise "[FaceRuntime] ONNX Runtime package checksum mismatch (got #{actual}). Not using it."
  end
  system('unzip', '-q', '-o', nupkg, 'runtimes/ios/native/onnxruntime.xcframework.zip', '-d', vendor) &&
    system('unzip', '-q', '-o', File.join(vendor, 'runtimes/ios/native/onnxruntime.xcframework.zip'), '-d', vendor) ||
    raise('[FaceRuntime] Could not unpack the ONNX Runtime framework')
  FileUtils.rm_rf([nupkg, File.join(vendor, 'runtimes')])
  raise '[FaceRuntime] onnxruntime.xcframework missing after unpacking' unless File.directory?(framework)
  File.write(stamp, ort_sha512)
end

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

  s.source_files = '*.{h,m,mm,swift}'
  s.public_header_files = 'FaceRuntimeSession.h'
  s.vendored_frameworks = 'vendor/onnxruntime.xcframework'
  # What the onnxruntime-c pod linked.
  s.frameworks = 'CoreFoundation', 'Foundation', 'Network', 'Security', 'SystemConfiguration', 'UIKit'
  s.weak_frameworks = 'CoreML'
  s.libraries = 'c++'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'OTHER_CPLUSPLUSFLAGS' => '-fvisibility=hidden -fvisibility-inlines-hidden'
  }
end
