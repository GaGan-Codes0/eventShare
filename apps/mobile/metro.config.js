// Expo's defaults, plus the face models (.onnx) bundled as assets.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('onnx');

module.exports = config;
