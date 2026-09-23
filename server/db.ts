import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL is not set in server/.env. Please provide your Neon connection string.');
}

// Neon SQL tagged-template client
export const sql = connectionString ? neon(connectionString) : null;

// Initialize the database table and migrations
export async function initDb() {
  if (!sql) {
    console.warn('⚠️  Skipping DB initialization: DATABASE_URL not set.');
    return;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled document',
        view_token VARCHAR(64) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    // Ensure view_token exists for any previously created table
    await sql`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS view_token VARCHAR(64) UNIQUE;
    `;
    console.log('✅ Connected to Neon PostgreSQL: "documents" table verified with capability view_token.');
  } catch (err) {
    console.error('❌ Failed to connect to Neon PostgreSQL:', err);
  }
}
