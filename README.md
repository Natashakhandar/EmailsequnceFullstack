# Mail Sequencing Platform

Comprehensive email sequencing system featuring a Node.js/Express backend, React + Vite frontend, Prisma ORM, job scheduler, and role-based administration.

---

## Table of Contents

- **[Architecture Overview](#architecture-overview)**
- **[Repository Structure](#repository-structure)**
- **[Key Features](#key-features)**
- **[Prerequisites](#prerequisites)**
- **[Backend Setup](#backend-setup)**
- **[Frontend Setup](#frontend-setup)**
- **[Authentication & Roles](#authentication--roles)**
- **[Admin Management](#admin-management)**
- **[Environment Variables](#environment-variables)**
- **[Useful Scripts](#useful-scripts)**
- **[Troubleshooting & Docs](#troubleshooting--docs)**
- **[Development Notes](#development-notes)**

---

## Architecture Overview

- **Backend**: `backend/` — Express API, Prisma ORM, job scheduler for email processing, authentication middleware, and REST routes for contacts, templates, sequences, enrollments, events, scheduler triggers, and email activity.
- **Frontend**: `emailseq-frontend/` — Vite + React + TypeScript application using ShadCN UI components, React Router, React Query, and TailwindCSS.
- **Database**: Prisma schema configured for MySQL (update `DATABASE_URL` accordingly).
- **Background Jobs**: Scheduler located under `backend/src/jobs/` orchestrates email sending and enrollment processing.

---

## Repository Structure

```text
Mail_Sequencing/
├── backend/                     # Express API & Prisma layer
│   ├── prisma/                  # Prisma schema & migrations
│   ├── scripts/                 # Utility scripts (admin management, tests)
│   └── src/                     # Application source (routes, jobs, utils)
├── emailseq-frontend/           # Vite + React client
│   └── src/                     # Pages, components, lib utilities
├── docs/                        # Project documentation & guides
└── README.md                    # Project overview (this file)
```

---

## Key Features

- **RESTful API** covering contacts, templates, sequences, enrollments, events, scheduler controls, unsubscribe, and email activity (`backend/src/routes/`).
- **Authentication** with JWT, bcrypt-secured passwords, and role-based middleware (`backend/src/middleware/auth.js`).
- **Role Hierarchy** supporting `USER`, `ADMIN`, and `SUPERADMIN` with granular permissions.
- **Superadmin Console** for managing admin users via frontend (`emailseq-frontend/src/pages/AdminManagement.tsx`) and CLI (`backend/manage-admins.js`).
- **Scheduler** for automated sequence processing (`backend/src/jobs/scheduler.js`).
- **Frontend Dashboard** with rich UI, sequences management, leads, templates, email analytics, and profile management.
- **Enhanced Debugging** tools for troubleshooting enrollment issues (see `docs/`).

---

## Prerequisites

- **Node.js** >= 18.x (backend engine requirement is >= 16, but 18+ recommended).
- **npm** or **pnpm** for dependency management.
- **Database**: MySQL-compatible instance (align `DATABASE_URL` with `prisma/schema.prisma`).
- **SMTP** credentials for outbound email (configured via `.env`).

---

## Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment template and update values
cp .env.example .env
# edit .env to set DATABASE_URL, SMTP settings, JWT secret, etc.

# Generate Prisma client & sync schema
npx prisma generate
npx prisma db push

# Seed superadmin (optional default credentials)
node create-superadmin.js

# Start development server
npm run dev
# API listens on PORT (default 3001)
```

### Backend Highlights

- API entry: `backend/src/index.js`
- Scheduler startup: `startScheduler()` invoked on server boot
- Authentication routes: `backend/src/routes/auth.js`
- JWT secret: `JWT_SECRET` env variable

---

## Frontend Setup

```bash
# Navigate to frontend
cd emailseq-frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
# Default: http://localhost:5173
```

### Frontend Highlights

- Routing: `emailseq-frontend/src/App.tsx`
- Authentication UI: `emailseq-frontend/src/pages/Login.tsx`
- Profile with live user data: `emailseq-frontend/src/pages/Profile.tsx`
- Admin management UI (superadmin only): `emailseq-frontend/src/pages/AdminManagement.tsx`
- Shared API client: `emailseq-frontend/src/lib/api.ts`

Ensure the frontend `.env` (if used) points to backend base URL (`http://localhost:3001/api` by default).

---

## Authentication & Roles

- **Login**: `/api/auth/login` returns JWT + user payload.
- **Middleware**: `authenticateToken`, `requireAdmin`, `requireSuperAdmin` guard backend routes.
- **Roles**:
  - `SUPERADMIN`: Full access, can manage other admins/users.
  - `ADMIN`: Elevated permissions for operational tasks (no access to superadmin-only endpoints).
  - `USER`: Standard access for sequencing tasks.
- Initial superadmin seeded via `create-superadmin.js` (credentials configurable through `.env`).

---

## Admin Management

### CLI (`backend/manage-admins.js`)

```bash
# Help / default usage
node manage-admins.js

# Create admin
node manage-admins.js create admin@company.com StrongP@ss! Jane Doe ADMIN

# Update admin
node manage-admins.js update admin@company.com StrongerP@ss! Jane Doe SUPERADMIN

# List all admins
node manage-admins.js list

# Activate / Deactivate
node manage-admins.js activate admin@company.com
node manage-admins.js deactivate admin@company.com
```

### Web UI

- Navigate to `/admin-management` (only visible to superadmins in navbar/dropdown).
- Create, update, activate/deactivate, and delete admin accounts with inline feedback.

---

## Environment Variables

Create `backend/.env` based on `.env.example` and ensure the following keys are set:

| Variable | Description |
| --- | --- |
| `PORT` | Backend server port (default `3001`). |
| `DATABASE_URL` | MySQL connection string (`mysql://user:password@host:port/database`). |
| `JWT_SECRET` | Secret for signing JWT tokens. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Outbound email SMTP credentials. |
| `FROM_EMAIL` / `FROM_NAME` | Default sender information. |
| `APP_URL` | Base URL used in unsubscribe links and callbacks. |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Optional overrides for `create-superadmin.js`. |

Update the frontend configuration if a proxy or different backend origin is used (`emailseq-frontend/src/lib/api.ts`).

---

## Useful Scripts

- **Backend**
  - `npm run dev`: Start Express server with nodemon.
  - `npm run start`: Start Express server without watchers.
  - `npm run db:generate`: Generate Prisma client.
  - `npm run db:push`: Push Prisma schema to database.
  - `node create-superadmin.js`: Seed initial superadmin account.
  - `node manage-admins.js <command>`: Manage admin accounts (see above).
- **Frontend**
  - `npm run dev`: Start Vite dev environment.
  - `npm run build`: Production build output (`dist/`).
  - `npm run preview`: Preview production bundle locally.

---

## Troubleshooting & Docs

- **Docs Directory**: `docs/` contains focused guides, e.g. `SEQUENCE_TROUBLESHOOTING_GUIDE.md` for debugging enrollment or sequence issues.
- **Scheduler Logs**: Monitor backend console for scheduler status messages on boot.
- **Common Issues**:
  - Database connection errors → verify `DATABASE_URL` matches Prisma provider.
  - SMTP failures → confirm credentials and less-secure-app access (if applicable).
  - Authentication failures → ensure JWT secret consistency and token validity.

---

## Development Notes

- Ensure `scripts/test-scripts/` remains ignored by Git to avoid committing local automation utilities.
- Keep backend and frontend servers running concurrently for full functionality.
- Update Prisma schema and regenerate client when modifying models (`npx prisma generate`).
- Consider configuring HTTPS proxies or environment-specific settings for deployment.

---

**License**: MIT (see `backend/package.json`).

For further assistance, review route handlers and jobs within `backend/src/`, or UI components in `emailseq-frontend/src/`. Contributions and enhancements are welcome!
