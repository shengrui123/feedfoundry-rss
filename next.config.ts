import type { NextConfig } from 'next';

const nextConfig: NextConfig = process.env.VERCEL_BUILD === '1'
  ? {
      turbopack: {
        resolveAlias: {
          'cloudflare:workers': './db/vercel-env.ts',
        },
      },
    }
  : {};

export default nextConfig;
