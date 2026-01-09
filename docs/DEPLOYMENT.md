# Deployment Guide

This guide covers deploying Noeron to production with Vercel (frontend) and Railway (backend).

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Vercel        │      │   Railway       │      │   Supabase      │
│   (Frontend)    │─────▶│   (Backend)     │─────▶│   (Database)    │
│   Next.js       │      │   FastAPI       │      │   pgvector      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Prerequisites

- [Vercel account](https://vercel.com) (free tier works)
- [Railway account](https://railway.app) (free tier: $5/month credit)
- Supabase project (already set up)
- GitHub repository (for automatic deployments)

---

## Step 1: Deploy Backend to Railway

Railway is recommended for Python backends because it supports long-running processes and has good free tier.

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository

### 1.2 Configure Build Settings

Railway should auto-detect Python. If not, add a `railway.toml`:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "python -m src.bioelectricity_research.http_server"
healthcheckPath = "/"
healthcheckTimeout = 300
```

Or create a `Procfile` in the root:

```
web: python -m src.bioelectricity_research.http_server
```

### 1.3 Set Environment Variables

In Railway dashboard → **Variables**, add:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Your Supabase service key |
| `USE_SUPABASE` | `true` |
| `PORT` | `8000` |

### 1.4 Deploy

Railway will automatically deploy when you push to main. Note your deployment URL (e.g., `https://your-app.railway.app`).

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Set **Root Directory** to `frontend`
5. Framework Preset should auto-detect **Next.js**

### 2.2 Set Environment Variables

In Vercel dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `MCP_PROXY_TARGET` | Your Railway URL (e.g., `https://your-app.railway.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

⚠️ **Never add `SUPABASE_SERVICE_KEY` to Vercel** - it's not needed and would be exposed to browsers.

### 2.3 Deploy

Click **Deploy**. Vercel will build and deploy your frontend.

---

## Step 3: Configure CORS (if needed)

If you get CORS errors, update `http_server.py` to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",
        "https://your-custom-domain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Currently it's set to `allow_origins=["*"]` which allows all origins.

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service key (for server-side operations) |
| `USE_SUPABASE` | Yes | Set to `true` for production |
| `PORT` | No | Server port (default: 8000) |
| `ASSEMBLYAI_API_KEY` | No | Only needed for transcript generation |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_PROXY_TARGET` | Yes | Backend URL (Railway) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe to expose) |

---

## Troubleshooting

### "Failed to connect to MCP server"

- Check that `MCP_PROXY_TARGET` is set correctly in Vercel
- Verify Railway deployment is running
- Check Railway logs for errors

### "Supabase not configured"

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
- Note: `NEXT_PUBLIC_` prefix is required for client-side access

### Vector search returns no results

- Verify `USE_SUPABASE=true` in Railway
- Check that paper_chunks table has embeddings
- Test with: `curl -X POST https://your-app.railway.app/tools/chat_with_context/execute -H "Content-Type: application/json" -d '{"message": "test", "episode_id": "lex_325"}'`

### Railway build fails

Make sure `pyproject.toml` or `requirements.txt` lists all dependencies:
- `fastapi`
- `uvicorn`
- `google-genai`
- `supabase`
- `sentence-transformers`

---

## Alternative: Render.com

If Railway doesn't work for you, [Render](https://render.com) is another good option:

1. Create a new **Web Service**
2. Connect your GitHub repo
3. Set **Build Command**: `pip install -e .`
4. Set **Start Command**: `python -m src.bioelectricity_research.http_server`
5. Add environment variables (same as Railway)

---

## Security Checklist

Before deploying:

- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] No API keys in git history (use `git log -p -- "*.env*"` to check)
- [ ] `SUPABASE_SERVICE_KEY` is NOT in frontend environment
- [ ] CORS is configured for your domains
- [ ] Supabase RLS is enabled if multi-user (currently disabled for single-user)
