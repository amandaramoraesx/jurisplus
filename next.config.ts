import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Padrão é 1mb; anexos de aula (PDF, foto, slide) precisam de mais espaço.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
