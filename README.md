# Radio Station Backend API

A Node.js/Express API for managing radio stations with TypeScript, Prisma, and PostgreSQL.

## Features

- 🎵 Station CRUD operations
- 📊 Radio Browser API integration  
- 🔍 Web scraping for station metadata
- 🏥 Stream health monitoring
- 📈 Import/export functionality
- 🎛️ Admin management tools

## Deployment to Render

### Prerequisites
1. PostgreSQL database created on Render
2. GitHub repository connected to Render

### Environment Variables
Set these in your Render service:

```
NODE_ENV=production
DATABASE_URL=postgresql://streemr_user:uy9IcetHC6stgDxvTT5ZewRMGk5pTbDY@dpg-d1iuiqemcj7s739ua480-a.oregon-postgres.render.com/streemr
```

### Build Commands
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`

### Deployment Steps
1. Push your code to GitHub
2. Connect the repository to Render
3. Set the environment variables
4. Deploy

## Local Development

### With SQLite (Development)
```bash
# Use development schema
cp prisma/schema.dev.prisma prisma/schema.prisma

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma db push

# Start development server
npm run dev
```

### With PostgreSQL (Production-like)
```bash
# Set DATABASE_URL in .env file
echo "DATABASE_URL=your_postgres_url" > .env

# Use production schema (already set)
# Generate and deploy
npx prisma generate
npx prisma db push

# Start server
npm run dev
```

## API Endpoints

- `GET /` - Health check
- `GET /stations` - List stations
- `GET /stations/search?q=term` - Search stations
- `POST /stations` - Create station
- `PUT /stations/:id` - Update station
- `DELETE /stations/:id` - Delete station
- `POST /import/radio-browser` - Import from Radio Browser
- `POST /scrape/business` - Scrape station info
- `POST /health/check/:id` - Check stream health
- `GET /admin/*` - Admin operations

## Database Schema

The application uses Prisma with a comprehensive Station model including:
- Basic info (name, country, genre, etc.)
- Technical details (bitrate, codec, stream URL)
- Geographic data (coordinates, city, state)
- Social media links
- Contact information
- Health monitoring data
- Radio Browser integration

## Troubleshooting

### Build Errors
- Ensure all TypeScript types are properly defined
- Check Prisma client generation
- Verify environment variables

### Database Issues
- Confirm DATABASE_URL is correct
- Run `npx prisma db push` to sync schema
- Check network connectivity to database

### Import Issues
- Verify node-fetch compatibility
- Check CORS configuration
- Ensure proper error handling