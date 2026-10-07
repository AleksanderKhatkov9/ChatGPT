/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/:path*", // FastAPI backend
        },
      ];
    },
  };
  
  export default nextConfig;
  