#!/usr/bin/env node

/**
 * Keep-Alive Script for Render Backend
 * 
 * This script pings the Render backend every 10 minutes to prevent it from spinning down.
 * Render's free tier spins down after 15 minutes of inactivity.
 */

const https = require('https');

// Your Render backend URL
const BACKEND_URL = 'https://streemr-back.onrender.com';

// Ping interval in milliseconds (10 minutes)
const PING_INTERVAL = 10 * 60 * 1000;

function pingBackend() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Pinging backend: ${BACKEND_URL}/ping`);
  
  const startTime = Date.now();
  
  https.get(`${BACKEND_URL}/ping`, (res) => {
    const duration = Date.now() - startTime;
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`[${timestamp}] ✅ Backend is alive (${duration}ms) - Response: ${data.substring(0, 100)}`);
      } else {
        console.log(`[${timestamp}] ⚠️ Backend responded with status ${res.statusCode}`);
      }
    });
  }).on('error', (err) => {
    console.log(`[${timestamp}] ❌ Failed to ping backend: ${err.message}`);
  });
}

// Initial ping
console.log('🚀 Starting keep-alive service for Render backend...');
console.log(`📡 Will ping ${BACKEND_URL}/ping every ${PING_INTERVAL / 1000 / 60} minutes`);
pingBackend();

// Set up interval
setInterval(pingBackend, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Keep-alive service stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Keep-alive service terminated');
  process.exit(0);
});