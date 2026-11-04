// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Colors and fonts change per event (host themes): read them with useTheme() / makeStyles()
    // from '@/theme'. Only the theme module itself may import the defaults.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/constants/theme',
              importNames: ['colors', 'fonts', 'typeScale'],
              message: "Use useTheme() or makeStyles() from '@/theme' so the event's theme applies.",
            },
          ],
        },
      ],
    },
  },
]);
