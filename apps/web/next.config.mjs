/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },

  // Add security headers for WASM/SharedArrayBuffer support in Brave
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
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
      // Add topLevelAwait to support WASM initialization
      topLevelAwait: true,
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
        // Prevent module concatenation which can duplicate WASM instances
        concatenateModules: false,
        splitChunks: {
          chunks: 'all',
          // Increase limits to allow more granular code splitting
          maxInitialRequests: 25,
          maxAsyncRequests: 30,
          // Reduce min sizes to ensure better chunking
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // Group all WASM-related code together to ensure single initialization
            wasm: {
              test: /\.wasm$/,
              name: 'wasm-modules',
              priority: 30, // Highest priority
              enforce: true,
              reuseExistingChunk: true,
            },
            // CRITICAL: Consolidate ALL @polkadot packages into a single chunk
            // This prevents multiple WASM instances from being created
            polkadot: {
              test: /[\\/]node_modules[\\/](@polkadot|polkadot-api)[\\/]/,
              name: 'polkadot-bundle',
              priority: 25,
              enforce: true,
              reuseExistingChunk: true,
              // Force all polkadot code into this chunk
              chunks: 'all',
            },
            // Consolidate ParaSpell packages (which also use Polkadot)
            paraspell: {
              test: /[\\/]node_modules[\\/]@paraspell[\\/]/,
              name: 'paraspell-bundle',
              priority: 20,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Separate vendor chunks for other large dependencies
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
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
    // Enable modern output to reduce bundle size
    optimizePackageImports: ['@polkadot/util', '@polkadot/util-crypto'],
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