import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['**/dist/**', '**/.astro/**', '**/.vercel/**', 'Leyma Shop.html'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // Astro genera env.d.ts con una referencia de triple barra.
  { files: ['**/scripts/**'], rules: { 'no-undef': 'off' } },
  { files: ['**/env.d.ts'], rules: { '@typescript-eslint/triple-slash-reference': 'off' } },
];
