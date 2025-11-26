import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.md": {
        loaders: [
          {
            loader: "builtin:raw",
            options: {},
          },
        ],
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const previous = config.externals ?? [];
      const normalized = Array.isArray(previous) ? previous : [previous];
      config.externals = [...normalized, 'esbuild'];
    }
    config.module.rules.push({
      test: /\.md$/i,
      type: "asset/source",
    });

    return config;
  },
};

export default nextConfig;
