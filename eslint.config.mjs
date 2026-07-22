import antfu from '@antfu/eslint-config'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  antfu({
    stylistic: {
      indent: 2,
    },
    formatters: true,
    rules: {
      'no-console': 'off',
      'pnpm/yaml-enforce-settings': 'off',
      'vue/no-required-prop-with-default': 'off',
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
    },
  }),
  eslintPluginBetterTailwindcss.configs.recommended,
  {
    rules: {
      'better-tailwindcss/enforce-shorthand-classes': 'warn',
      'better-tailwindcss/no-unknown-classes': 'off',
    },
  },
  {
    ignores: ['**/*.md'],
  },
)
