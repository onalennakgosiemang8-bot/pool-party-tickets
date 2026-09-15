/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Prisma, pdf-lib and qrcode are CommonJS/native and must not be bundled
  // into the serverless function's webpack output.
  serverExternalPackages: ['@prisma/client', 'pdf-lib', 'qrcode'],

  images: {
    formats: ['image/avif', 'image/webp'],
    // The hero photograph never changes; cache the optimised variants hard.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Type errors still fail the build — that is the check worth keeping.
  typescript: { ignoreBuildErrors: false },
  // No ESLint config ships with this project, so linting never blocks a deploy.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
