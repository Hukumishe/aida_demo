# AIDA Beauty Platform Backend

Production-ready backend for beauty studio booking platform MVP.

## Tech Stack

- **Node.js 20** + **TypeScript**
- **NestJS** - Progressive Node.js framework
- **PostgreSQL** (Railway Postgres)
- **Prisma ORM** - Next-generation ORM
- **JWT Authentication** - Access + Refresh tokens
- **Swagger/OpenAPI** - API documentation
- **class-validator** - DTO validation

## Features

- 🔐 JWT-based authentication with access and refresh tokens
- 👥 Role-based access control (RBAC): OWNER, MANAGER, MASTER
- 🏢 Multi-studio support with studio scoping
- 📅 Work schedule management with template generation (5/2, 6/1)
- 🚫 Busy slots management
- 📋 Appointment booking with availability validation
- 👤 Client management
- 💼 Staff management
- 🛠️ Service management

## Prerequisites

- Node.js 20+
- PostgreSQL (or use Railway Postgres)
- npm or yarn

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url>
cd AIDA
npm install
```

### 2. Environment Variables

Create `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/aida_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"

# Опционально: API-ключ для ботов (NextBot и др.). Если задан, запросы с заголовком X-API-Key или Authorization: ApiKey <key> считаются авторизованными (роль SERVICE).
# NEXTBOT_API_KEY="your-secret-api-key"
```

### 3. Database Setup

Using Docker Compose:

```bash
docker-compose up -d
```

Or use your own PostgreSQL instance.

### 4. Run Migrations

```bash
npm run prisma:migrate
```

### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

### 6. Seed Database (Optional)

```bash
npm run seed
```

This creates:
- 1 Studio
- 1 Owner (owner@example.com / owner123)
- 1 Manager (manager@example.com / manager123)
- 1 Master (master@example.com / master123)
- 1 Client
- 1 Service
- Sample work schedule

### 7. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`
Swagger documentation: `http://localhost:3000/docs`

## Railway Deployment

### 1. Create Railway Account

1. Go to [Railway](https://railway.app)
2. Sign up or log in
3. Create a new project

### 2. Create PostgreSQL Database

1. In your Railway project, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will automatically create a PostgreSQL instance
3. Copy the `DATABASE_URL` from the database service (it will be in the format: `postgresql://postgres:password@hostname:port/railway`)

### 3. Create API Service

1. In your Railway project, click **"New"** → **"GitHub Repo"** (or deploy from CLI)
2. Connect your repository
3. Railway will detect it's a Node.js project and use Nixpacks

### 4. Configure Environment Variables

In your API service settings, add these environment variables:

```env
DATABASE_URL=<from-postgres-service>
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
CORS_ORIGIN=<your-frontend-url>
```

**Important:** Generate strong secrets for JWT:
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Configure Build and Start Commands

Railway will automatically detect the `Procfile` which contains:

```
release: npx prisma migrate deploy && npx prisma generate
web: node dist/main.js
```

This ensures:
- Migrations are applied automatically on deploy
- Prisma client is generated
- App listens on `process.env.PORT` (Railway sets this automatically)

### 6. Deploy

1. Push your code to the connected repository
2. Railway will automatically build and deploy
3. Check the logs to ensure migrations ran successfully

### 7. Verify Deployment

1. Check health endpoint: `https://your-app.railway.app/health`
2. Check Swagger docs: `https://your-app.railway.app/docs`
3. Test login endpoint: `POST /auth/login`

## API Endpoints

### Authentication
- `POST /auth/login` - Login with phone and password
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user info

### Studios
- `GET /studios` - Get all studios (OWNER sees all, others see only their studio)
- `POST /studios` - Create studio (OWNER only)
- `GET /studios/:studioId` - Get studio by ID

### Staff
- `GET /studios/:studioId/staff` - Get all staff members
- `POST /studios/:studioId/staff` - Create staff member
- `PATCH /staff/:userId` - Update staff member

### Clients
- `GET /clients?q=` - List clients for the caller’s organization (optional `organizationId` for DEVELOPER)
- `GET /clients/segments?studioId=` - Segment counts (per studio; last visit in that branch)
- `GET /clients/referred` / `GET /clients/referrers` - Referral tables
- `POST /clients` - Create client
- `GET /clients/:id` - Get client by ID
- `PATCH /clients/:id` - Update client

### Services
- `GET /services` - Organization catalog (optional `studioId` for `isOfferedInStudio`; optional `organizationId` for DEVELOPER)
- `GET /services/categories` - Service categories (optional `organizationId` for DEVELOPER)
- `POST /services` / `POST /services/categories` - Create
- `PATCH /services/:id` - Update service
- `PATCH /services/:id/studio-offering` - Body `{ studioId, offered }` — toggle offering per branch

### Schedule
- `GET /studios/:studioId/schedule?date=YYYY-MM-DD` - Get schedule
- `POST /studios/:studioId/schedule` - Create/update schedule day
- `POST /studios/:studioId/schedule/generate` - Generate schedule from template (5/2 or 6/1)
- `PATCH /schedule/day/:id` - Update schedule day

### Busy Slots
- `GET /studios/:studioId/busy-slots?date=YYYY-MM-DD` - Get busy slots
- `POST /studios/:studioId/busy-slots` - Create busy slot
- `PATCH /busy-slots/:id` - Update busy slot
- `DELETE /busy-slots/:id` - Delete busy slot

### Appointments
- `GET /studios/:studioId/appointments?date=YYYY-MM-DD` - Get appointments
- `POST /studios/:studioId/appointments` - Create appointment
- `PATCH /appointments/:id` - Update appointment
- `POST /appointments/:id/cancel` - Cancel appointment
- `POST /appointments/:id/arrived` - Mark appointment as arrived

## Role-Based Access Control

### OWNER
- Access to all studios
- Can create studios
- Can manage all staff, clients, services, schedules, appointments

### MANAGER
- Access only to their assigned studio
- Can manage staff, clients, services, schedules, appointments within their studio
- Cannot create studios

### MASTER
- Access only to their assigned studio
- Can view and manage only their own schedule and appointments
- Cannot manage other staff or clients

## Validation Rules

### Appointments
- Cannot be created/updated if:
  - No work schedule exists for the date or day is off
  - Outside work hours (startTime-endTime)
  - Overlaps with break time
  - Overlaps with busy slot
  - Overlaps with another appointment (except CANCELLED)

### Busy Slots
- Must be within work schedule hours
- Cannot overlap with break time

### Schedule
- endTime must be greater than startTime
- breakEnd must be greater than breakStart
- Break must be within work hours

## Testing

Run unit tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:cov
```

## Scripts

- `npm run build` - Build the project
- `npm run start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run start:debug` - Start in debug mode
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run migrations (dev)
- `npm run prisma:migrate:deploy` - Deploy migrations (production)
- `npm run seed` - Seed database

## Project Structure

```
src/
├── app.module.ts          # Root module
├── main.ts                # Application entry point
├── app.controller.ts      # Health check controller
├── auth/                  # Authentication module
├── studios/               # Studios module
├── users/                 # Staff/users module
├── clients/               # Clients module
├── services/              # Services module
├── schedule/              # Work schedule module
├── busy-slots/            # Busy slots module
├── appointments/          # Appointments module
├── availability/           # Availability service
└── common/                # Shared modules
    ├── guards/            # Auth guards
    ├── decorators/        # Custom decorators
    ├── filters/           # Exception filters
    ├── exceptions/        # Custom exceptions
    └── prisma/            # Prisma service
```

## License

Private - All rights reserved




