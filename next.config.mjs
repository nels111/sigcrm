/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for @react-pdf/renderer (uses canvas/yoga)
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
