import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dietz-en",
        destination:
          "https://dietz-verlag.de/isbn/9783801231118/The-Open-Future-and-Its-Enemies-How-we-can-Protect-Free-Society-from-AI-Dictatorship-Matthias-Pfeffer-Juergen-Pfeffer-Paul-Nemitz",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
