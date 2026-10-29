// Tests run against the atk_test database and local Valkey (docker compose), or the CI
// service containers. These are throwaway local values, not secrets.
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://atk:atk@localhost:5432/atk_test'

export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  DATABASE_REPLICA_URL: '',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
  CLIENT_URL: 'http://localhost:3000',
  SERVER_PUBLIC_URL: 'http://localhost:5001',
  FORCE_HTTPS: 'false',
  COOKIE_DOMAIN: '',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnopqrstuv',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmnopqrstu',
  TOTP_ENCRYPTION_KEY: 'dGVzdC1vbmx5LXRvdHAta2V5LTAxMjM0NTY3ODlhYmM=',
  STAFF_TWO_FACTOR: 'true',
  CLOUDINARY_CLOUD_NAME: 'atk-test',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-cloudinary-secret',
  CLOUDINARY_FOLDER: 'atk-test',
  // eSewa's published UAT merchant and secret (developer.esewa.com.np); Khalti calls are mocked.
  KHALTI_SECRET_KEY: 'test-khalti-key',
  KHALTI_BASE_URL: 'https://dev.khalti.com/api/v2',
  ESEWA_PRODUCT_CODE: 'EPAYTEST',
  ESEWA_SECRET_KEY: '8gBm/:&EnhH.1/q',
  ESEWA_STATUS_URL: 'https://rc.esewa.com.np/api/epay/transaction/status/',
  REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
  REVALIDATE_SECRET: 'test-revalidate-secret-0123456789abcdefghijklmn',
  ADMIN_EMAIL: '',
  ADMIN_PASSWORD: '',
  LOG_LEVEL: 'error',
}
