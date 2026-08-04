import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    /* El bundle del embed lo genera esbuild a partir de three ya minificado:
       lintarlo son cientos de avisos sobre código que no escribimos ni podemos
       cambiar, y esconden los de verdad. */
    'public/embed-bundle/**',
    // Scripts de captura de una sesión concreta, no producto.
    'scripts/_*.mjs',
  ]),
]);

export default eslintConfig;
