# Aultrix Digital Configuration: Central LLM API + Clerk + Supabase

This repository has been configured so that:
1. **Central LLM API**: You can add your AI provider API key (e.g., OpenAI, OpenRouter, Gemini, Anthropic) into the codebase environment so all users can generate presentations without being prompted to enter an API key or configure providers.
2. **Clerk Authentication**: End users simply sign in using Clerk (Google, Email, GitHub, etc.). Legacy password setup is bypassed.
3. **Supabase Database**: All presentations, slides, and user records are stored directly in your Supabase PostgreSQL database.

---

## 1. Environment Configuration (`.env`)

Edit [`.env`](file:///d:/presenton-main/.env) at the root of the project:

```env
# ==============================================================================
# 1. AI / LLM API Configuration (Bake API into codebase for all users)
# ==============================================================================
# Choose your provider: "openai", "openrouter", "google", "anthropic", etc.
LLM=openai
OPENAI_API_KEY=sk-proj-...your-openai-api-key...
OPENAI_MODEL=gpt-4o

# Image Generation (Turn off if not using DALL-E/GPT-Image)
IMAGE_PROVIDER=gpt-image-2
DISABLE_IMAGE_GENERATION=false

# ==============================================================================
# 2. Clerk Authentication (Users sign in with Clerk)
# ==============================================================================
# Get these from https://dashboard.clerk.com -> API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# ==============================================================================
# 3. Supabase Database Configuration (PostgreSQL on Supabase)
# ==============================================================================
# Get your connection string from Supabase -> Project Settings -> Database -> Connection String (URI):
# Example: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.hsudmspwseonzfdaldxj.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://hsudmspwseonzfdaldxj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_S95sOi3C8gIS9u96HYSLSA_VAW-QYlF

# Automatically run Alembic migrations on Supabase upon server startup
MIGRATE_DATABASE_ON_STARTUP=true
```

---

## 2. How Each Component Works

### A. Central LLM API
- When `OPENAI_API_KEY` (or `OPENROUTER_API_KEY`, etc.) is placed in `.env`:
  - `server_runner.cjs` automatically syncs it into `userConfig.json` on startup.
  - Next.js detects that the provider is fully configured.
  - End-users are never prompted with "Provider setup required" or redirected to settings; they can start creating presentations immediately.

### B. Clerk Authentication
- `@clerk/nextjs` is installed and wrapped around the entire application in [`servers/nextjs/app/layout.tsx`](file:///d:/presenton-main/servers/nextjs/app/layout.tsx).
- Sign-in page is at [`/sign-in`](http://127.0.0.1:3001/sign-in) and sign-up page is at [`/sign-up`](http://127.0.0.1:3001/sign-up).
- When a user signs in, their avatar and profile are displayed in the dashboard sidebar and header via `<UserButton />`.
- When making API calls to FastAPI, Next.js forwards `x-clerk-user-id` and `x-clerk-user-email`.
- FastAPI automatically maps the Clerk user to a record in your database and isolates presentations per user.

### C. Supabase Database
- FastAPI connects to Supabase using `DATABASE_URL` via async SQLAlchemy (`asyncpg`) with SSL enabled.
- On startup, Alembic migrations run against Supabase PostgreSQL and create all necessary tables (`user`, `presentations`, `slides`, `async_tasks`, etc.).

---

## 3. Running the Server

Run the development servers:
```bash
npm start
# or
node server_runner.cjs
```
- **Next.js Frontend**: [http://127.0.0.1:3001](http://127.0.0.1:3001)
- **FastAPI Backend**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
