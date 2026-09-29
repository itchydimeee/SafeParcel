import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  // StrictMode's dev double-mount races Firestore's watch stream
  // (upstream: firebase-js-sdk#9968 "Unexpected state" assertion).
  reactStrictMode: false,
};

export default nextConfig;
