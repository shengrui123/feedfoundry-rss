import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize authentication');
}

const database = new Pool({
  connectionString: databaseUrl,
  max: 5,
});

const socialProviders = {
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? {
    github: {
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    },
  } : {}),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    },
  } : {}),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET ? {
    apple: {
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    },
  } : {}),
};

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders,
});
