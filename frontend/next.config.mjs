/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  onDemandEntries: {
    // Keep pages in memory for 1 hour in dev mode instead of dropping them after 60 seconds
    maxInactiveAge: 60 * 60 * 1000,
    // Keep up to 30 pages buffered in memory so switching back and forth is instantaneous
    pagesBufferLength: 30
  }
};

export default nextConfig;
