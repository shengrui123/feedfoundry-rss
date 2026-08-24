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

export const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
});
