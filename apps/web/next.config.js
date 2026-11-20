module.exports = {
  reactStrictMode: true,
  async rewrites() {
    const api = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};
