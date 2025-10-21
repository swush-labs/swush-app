/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  
  webpack: (config, { isServer, dev }) => {
    // CRITICAL: Set the output target to support async/await for WASM
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };

    // Enable async WebAssembly and layers (required for WASM modules)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Configure WASM file handling
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Optimize WASM module output
    if (!isServer) {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
      
      // 🔥 NEW: Increase memory limit for WASM in development
      if (dev) {
        config.optimization = {
          ...config.optimization,
          // Prevent creating duplicate WASM instances
          runtimeChunk: 'single',
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Group all WASM-related code together
              wasm: {
                test: /\.wasm$/,
                name: 'wasm-modules',
                priority: 20,
                enforce: true,
              },
              polkadot: {
                test: /[\\/]node_modules[\\/]@polkadot[\\/]/,
                name: 'polkadot',
                priority: 15,
              },
              paraspell: {
                test: /[\\/]node_modules[\\/]@paraspell[\\/]/,
                name: 'paraspell',
                priority: 15,
              },
            },
          },
        };
      }
    } else {
      config.output.webassemblyModuleFilename = './../static/wasm/[modulehash].wasm';
    }

    // Ignore node-specific modules in client bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      // 🔥 NEW: Prevent crypto polyfill issues
      crypto: false,
      stream: false,
      path: false,
    };

    return config;
  },

  // Ensure modern JavaScript target
  experimental: {
    esmExternals: 'loose',
  },

  // Transpile specific packages that use WASM
  transpilePackages: [
    '@galacticcouncil/math-hsm',
    '@galacticcouncil/math-xyk',
    '@galacticcouncil/math-lbp',
    '@galacticcouncil/math-liquidity-mining',
    '@galacticcouncil/math-omnipool',
    '@galacticcouncil/math-stableswap',
    '@galacticcouncil/sdk',
    '@paraspell/xcm-router',
    '@paraspell/sdk',
    // 🔥 NEW: Add @polkadot packages
    '@polkadot/wasm-crypto',
    '@polkadot/wasm-crypto-init',
    '@polkadot/wasm-crypto-wasm',
  ],
};

export default nextConfig;