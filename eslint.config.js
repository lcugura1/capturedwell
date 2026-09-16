import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['build/', '.react-router/', 'node_modules/', 'public/', 'design/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Hook rules catch the class of bug this codebase is most exposed to:
    // an effect that re-runs on every render and replays an animation, or
    // misses a dependency and animates against a stale rect. Wired by hand
    // rather than spreading the shipped config, which ESLint 10 rejects.
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
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
    files: ['scripts/shoot*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
)
