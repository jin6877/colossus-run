import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'test/**']),
  {
    // Imperative React-Three-Fiber app: the Engine mutates three/rapier objects
    // and refs outside React's render on purpose (PROJECT.md 임퍼러티브 경계), and
    // R3F code routinely mutates `scene` from useThree. Next 16's React-Compiler
    // rules flag those correct patterns, so we relax exactly those while keeping
    // rules-of-hooks, exhaustive-deps and unused-vars fully on.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);

export default eslintConfig;
