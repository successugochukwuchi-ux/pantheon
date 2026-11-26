const { withAppBuildGradle } = require('expo/config-plugins');

const ABI_SPLITS_MARKER = '// [withAbiSplits]';

const ABI_SPLITS_BLOCK = `
    ${ABI_SPLITS_MARKER}
    def isBundleTask = gradle.startParameter.taskNames.any { it.toLowerCase().contains('bundle') }
    splits {
        abi {
            enable !isBundleTask
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = config.modResults.contents;

    if (contents.includes(ABI_SPLITS_MARKER)) {
      return config;
    }

    // Insert splits { abi { ... } } inside the top-level android { ... } block
    if (/^android\s*\{/m.test(contents)) {
      contents = contents.replace(/^android\s*\{/m, (match) => `${match}\n${ABI_SPLITS_BLOCK}`);
    } else if (/android\s*\{/.test(contents)) {
      contents = contents.replace(/android\s*\{/, (match) => `${match}\n${ABI_SPLITS_BLOCK}`);
    }

    config.modResults.contents = contents;
    return config;
  });
};
