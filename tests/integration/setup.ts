// Shared setup: deterministic env for integration tests (mocked seams, no live DB).
process.env.INVITE_TOKEN ??= "test-invite-123";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.CLOUDINARY_CLOUD_NAME ??= "test-cloud";
