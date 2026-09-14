import type { NextConfig } from 'next';

// Vinext checks multipart requests before routing them to upload handlers.
// Keep this ceiling above the upload API's separately enforced 30 MB limit.
const nextConfig: NextConfig = {
  ...(process.env.DEPLOY_TARGET==='node'?{output:'standalone' as const}:{}),
  experimental: { serverActions: { bodySizeLimit: '32mb' } },
};

export default nextConfig;
