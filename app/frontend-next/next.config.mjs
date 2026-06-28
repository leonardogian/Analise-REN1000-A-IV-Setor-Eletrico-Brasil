/** @type {import('next').NextConfig} */
const RAILWAY_URL =
  process.env.API_REWRITE_URL ||
  'https://tcc-ren1000x414-production.up.railway.app';

const JSON_FILES = [
  'dashboard_data.json',
  'dashboard_scatter.json',
  'dashboard_timeseries.json',
  'dashboard_transgressoes.json',
  'dashboard_heatmap.json',
  'dashboard_radar.json',
  'dashboard_groups_ranking.json',
  'dashboard_municipios.json',
];

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${RAILWAY_URL}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${RAILWAY_URL}/health`,
      },
      ...JSON_FILES.map((file) => ({
        source: `/${file}`,
        destination: `${RAILWAY_URL}/${file}`,
      })),
    ];
  },
};

export default nextConfig;
