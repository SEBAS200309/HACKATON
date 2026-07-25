/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["http://192.168.40.14:3000"],
  experimental: {
    serverComponentsExternalPackages: ['ppu-paddle-ocr', 'sharp', 'onnxruntime-node', 'onnxruntime-common'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });
    }
    return config;
  },
};

export default nextConfig;
