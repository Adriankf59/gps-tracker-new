// Use HTTPS by default to avoid Mixed Content errors when the site is served over HTTPS
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://vehitrack.my.id/directus/items';
