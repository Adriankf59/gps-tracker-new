// Base URL for the Directus backend
// Use HTTP here because the EC2 server does not currently expose HTTPS.
// The frontend should access this through Next.js API routes to avoid
// mixed‑content issues.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
