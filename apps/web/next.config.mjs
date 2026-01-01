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
      
      // Apply WASM optimizations in both dev and production
      // This is CRITICAL to prevent "Out of memory: Cannot allocate Wasm memory" errors
      config.optimization = {
        ...config.optimization,
        // Prevent creating duplicate WASM instances - use single runtime chunk
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          // Increase limits to allow more granular code splitting
          maxInitialRequests: 25,
          maxAsyncRequests: 30,
          cacheGroups: {
            // Group all WASM-related code together to ensure single initialization
            wasm: {
              test: /\.wasm$/,
              name: 'wasm-modules',
              priority: 20,
              enforce: true,
              reuseExistingChunk: true, // Reuse existing chunks to avoid duplication
            },
            // Consolidate all @polkadot packages to avoid duplicate WASM instances
            polkadot: {
              test: /[\\/]node_modules[\\/]@polkadot[\\/]/,
              name: 'polkadot',
              priority: 15,
              enforce: true, // Force this caching group
              reuseExistingChunk: true,
            },
            // Consolidate ParaSpell packages
            paraspell: {
              test: /[\\/]node_modules[\\/]@paraspell[\\/]/,
              name: 'paraspell',
              priority: 15,
              reuseExistingChunk: true,
            },
          },
        },
      };
    } else {
      config.output.webassemblyModuleFilename = './../static/wasm/[modulehash].wasm';
    }

    // Ignore node-specific modules in client bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      // Prevent crypto polyfill issues
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

  // Reduced transpile list - only transpile what's absolutely necessary
  // The SDK packages already bundle their math dependencies
  transpilePackages: [
    '@galacticcouncil/sdk',
    '@paraspell/xcm-router',
    '@paraspell/sdk',
  ],
};

export default nextConfig;