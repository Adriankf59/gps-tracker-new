// aUse HTTPS by default to avoid Mixed Content errors when the site is served over HTTPS
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
