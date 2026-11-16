/** @type {import('next').NextConfig} */
const nextConfig = {
  // keep native/driver packages out of the bundle on the server
  experimental: { serverComponentsExternalPackages: ["mysql2", "mongodb", "bcryptjs"] },
};
export default nextConfig;
