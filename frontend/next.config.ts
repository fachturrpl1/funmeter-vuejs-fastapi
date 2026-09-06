import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy API routes to backend (port 8000)
      {
        source: "/face/register",
        destination: "http://localhost:8000/register-face",
      },
      {
        source: "/face/:path*",
        destination: "http://localhost:8000/face/:path*",
      },
      {
        source: "/register-face/:path*",
        destination: "http://localhost:8000/register-face/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:8000/admin/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://localhost:8000/auth/:path*",
      },
      {
        source: "/recognize-image",
        destination: "http://localhost:8000/recognize-image",
      },
      {
        source: "/attendance-log",
        destination: "http://localhost:8000/attendance-log",
      },
      {
        source: "/orgs/:path*",
        destination: "http://localhost:8000/orgs/:path*",
      },
      {
        source: "/register-db-data",
        destination: "http://localhost:8000/register-db-data",
      },
      {
        source: "/register-dataset",
        destination: "http://localhost:8000/register-dataset",
      },
    ];
  },
};

export default nextConfig;
