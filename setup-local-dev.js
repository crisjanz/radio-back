#!/usr/bin/env node

/**
 * Setup script for local development environment
 * This script helps initialize the local SQLite database and verify the setup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up local development environment...\n');

// Check if .env.development exists
const envDevPath = path.join(__dirname, '.env.development');
if (!fs.existsSync(envDevPath)) {
  console.error('❌ .env.development file not found!');
  console.log('Please create .env.development with the required environment variables.');
  process.exit(1);
}

console.log('✅ .env.development file found');

// Check if schema.dev.prisma exists
const schemaDevPath = path.join(__dirname, 'prisma', 'schema.dev.prisma');
if (!fs.existsSync(schemaDevPath)) {
  console.error('❌ prisma/schema.dev.prisma file not found!');
  console.log('Please ensure the SQLite schema file exists.');
  process.exit(1);
}

console.log('✅ SQLite schema file found');

try {
  // Install dependencies if needed
  console.log('\n📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Initialize local database
  console.log('\n🗄️  Initializing local SQLite database...');
  execSync('npm run db:init:local', { stdio: 'inherit' });
  
  console.log('\n✅ Local development environment setup complete!');
  console.log('\n🎉 You can now run:');
  console.log('   npm run dev:local    - Start local development server');
  console.log('   npm run db:studio:local - Open database browser');
  console.log('\nLocal server will run on: http://localhost:5000');
  
} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  console.log('\nPlease check the error above and try again.');
  process.exit(1);
}