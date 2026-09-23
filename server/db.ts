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
    // 1. Create documents table
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled document',
        view_token VARCHAR(64) UNIQUE,
        owner_id VARCHAR(255),
        owner_name VARCHAR(255),
        owner_email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    // Ensure capability view_token and ownership columns exist for any previously created table
    await sql`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS view_token VARCHAR(64) UNIQUE;
    `;
    await sql`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255);
    `;
    await sql`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
    `;
    await sql`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
    `;

    // 2. Create users table for Google OAuth & Demo accounts
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar_url TEXT,
        color VARCHAR(32) DEFAULT '#2563eb',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Connected to Neon PostgreSQL: "documents" & "users" tables verified.');
  } catch (err) {
    console.error('❌ Failed to connect to Neon PostgreSQL:', err);
  }
}
