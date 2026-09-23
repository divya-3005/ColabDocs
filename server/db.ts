import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL is not set in server/.env. Please provide your Neon connection string.');
}

// Neon SQL tagged-template client
export const sql = connectionString ? neon(connectionString) : null;

// Initialize the database table
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Connected to Neon PostgreSQL: "documents" table verified/created.');
  } catch (err) {
    console.error('❌ Failed to connect to Neon PostgreSQL:', err);
  }
}
