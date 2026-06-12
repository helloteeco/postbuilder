/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Next 14.1 has a race between .next/types generation and TS checking.
    // Type safety is enforced via editor + pre-commit; skip during build.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
