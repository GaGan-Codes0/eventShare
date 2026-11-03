// Signs Android release builds with our own upload key instead of the debug key.
// The keystore path and passwords come from ~/.gradle/gradle.properties (never committed):
//   EVENTSHARE_RELEASE_STORE_FILE, EVENTSHARE_RELEASE_STORE_PASSWORD,
//   EVENTSHARE_RELEASE_KEY_ALIAS, EVENTSHARE_RELEASE_KEY_PASSWORD
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// eventShare release signing';
const BLOCK = `
${MARKER}
if (project.hasProperty('EVENTSHARE_RELEASE_STORE_FILE')) {
    android.signingConfigs.create('eventshareRelease') {
        storeFile file(EVENTSHARE_RELEASE_STORE_FILE)
        storePassword EVENTSHARE_RELEASE_STORE_PASSWORD
        keyAlias EVENTSHARE_RELEASE_KEY_ALIAS
        keyPassword EVENTSHARE_RELEASE_KEY_PASSWORD
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.eventshareRelease
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
