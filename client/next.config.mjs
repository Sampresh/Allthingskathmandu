/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    // Cloudinary resizes (f_auto,q_auto, width per breakpoint); only its host is allowed.
    loader: 'custom',
    loaderFile: './src/lib/cloudinaryLoader.js',
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
}

export default nextConfig
