/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export', // Static export for S3 hosting
    images: {
        unoptimized: true // Required for static export
    },
    // Add trailing slash for S3 compatibility
    trailingSlash: true,
}

module.exports = nextConfig
