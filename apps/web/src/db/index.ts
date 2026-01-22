import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Initialize postgres client
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client
const client = postgres(connectionString);

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Re-export schema for convenience
export * from './schema';

// Type helper for transactions
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
