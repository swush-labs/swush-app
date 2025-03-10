import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['services/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@polkadot/api',
    '@polkadot/types',
    '@polkadot/util'
  ]
}); 