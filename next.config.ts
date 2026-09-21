import type { NextConfig } from "next";

const wgslLoader = "@vgpu/wgsl/loader-webpack";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.wgsl": { loaders: [wgslLoader], as: "*.js" },
    },
  },
  webpack(config) {
    config.module.rules.push({ test: /\.wgsl$/, loader: wgslLoader });
    return config;
  },
};

export default nextConfig;
