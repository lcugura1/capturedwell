import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['build/', '.react-router/', 'node_modules/', 'public/', 'design/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // The design system lives in theme.css; `any` and silent ignores are
      // how a codebase drifts away from it without anyone noticing.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    // The callbacks passed to page.evaluate() are serialised and run inside
    // the browser, not in Node, so browser globals are correct there.
    files: ['scripts/shoot.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
  },
)
