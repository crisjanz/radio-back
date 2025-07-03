# Local Development Setup Guide

This guide will help you set up a local development environment for the radio backend that uses SQLite instead of PostgreSQL.

## Quick Start

1. **Install dependencies** (including the new dotenv-cli):
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   - Copy `.env.development` and update the values as needed
   - Update `JWT_SECRET`, `SMTP_*` values with your actual credentials

3. **Initialize local database**:
   ```bash
   npm run db:init:local
   ```

4. **Start development server**:
   ```bash
   npm run dev:local
   ```

Your local backend will now run on `http://localhost:5000`

## Available Scripts

### Development
- `npm run dev` - Runs against production/Render database (existing setup)
- `npm run dev:local` - Runs against local SQLite database

### Database Management
- `npm run db:init:local` - Initialize local SQLite database with schema
- `npm run db:studio:local` - Open Prisma Studio for local database
- `npm run db:seed:local` - Seed local database with data from existing export

### Build
- `npm run build` - Build for production (PostgreSQL)
- `npm run build:local` - Build for local development (SQLite)

## Environment Files

### `.env.development` (Local Development)
```
NODE_ENV=development
PORT=5000
DATABASE_URL="file:./prisma/dev.db"
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_here
# ... other settings
```

### `.env` (Production - not included in repo)
Your production environment variables for Render deployment.

## Database Schema

- `prisma/schema.prisma` - Production PostgreSQL schema
- `prisma/schema.dev.prisma` - Local development SQLite schema

The SQLite schema is nearly identical to PostgreSQL, with these differences:
- Uses `provider = "sqlite"` instead of `"postgresql"`
- Float fields use `Real` instead of `Float` (SQLite compatible)

## Seeding Local Database

If you want to populate your local database with existing data:

1. Make sure you have a data export file (like `stations-export.json`)
2. Run: `npm run db:seed:local`

This will import the data into your local SQLite database.

## Frontend Configuration

Make sure your frontend development server points to the local backend:

```javascript
// In your frontend config
const API_BASE_URL = 'http://localhost:5000';
```

## Troubleshooting

### Database Connection Issues
- Ensure the `prisma/` directory exists
- Check that `DATABASE_URL` in `.env.development` points to a valid file path
- Run `npm run db:init:local` to recreate the database

### Port Conflicts
- Change `PORT=5000` in `.env.development` to another port if needed
- Update your frontend configuration accordingly

### Environment Variables Not Loading
- Ensure `dotenv-cli` is installed: `npm install dotenv-cli --save-dev`
- Check that `.env.development` exists and has correct syntax

## Development Workflow

1. Make changes to your code
2. Test locally with `npm run dev:local`
3. When ready, test against production database with `npm run dev`
4. Deploy to production

This setup allows you to:
- Test new features locally without affecting production data
- Work offline with a local database
- Easily reset/seed your local database for testing
- Keep production and development environments separate