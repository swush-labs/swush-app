/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Remove static export for Vercel deployment
  // output: 'export',
  // basePath: process.env.NODE_ENV === 'production' ? '/swush-me-app' : '',
};

export default nextConfig;
