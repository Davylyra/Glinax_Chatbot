# Frontend Production Deployment Guide

## 🎯 Overview

This document describes the configuration and fixes applied to resolve the blank page issue in production (`npm run preview`) and on Vercel deployment.

## 🐛 Root Cause Analysis

### Issue Description

- **Development (`npm run dev`)**: ✅ Works correctly
- **Production (`npm run build && npm run preview`)**: ❌ Blank page
- **Vercel Deployment**: ❌ Blank page

### Root Causes Identified

1. **Stale Build Output**: Old `dist/` folder had mismatched asset file names
2. **MIME Type Errors**: Browser expected JavaScript modules but received text/html
3. **Missing SPA Routing Config**: Vercel didn't redirect all routes to index.html
4. **Environment Variables**: Production env vars not configured on deployment platform

## ✅ Solutions Implemented

### 1. Vite Configuration (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  base: "/", // ← CRITICAL: Ensures assets load from root path
  build: {
    rollupOptions: {
      /* ... */
    },
    sourcemap: false, // Disable in production for security
    target: "es2015",
    minify: "esbuild",
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
});
```

**Key Points:**

- `base: '/'` ensures all assets load from the root URL
- Production builds drop console.log statements
- Optimized chunk splitting for faster loads

### 2. Vercel Configuration (`vercel.json`)

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Purpose:** All routes redirect to index.html for SPA routing (React Router)

### 3. Netlify Configuration (`netlify.toml`)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Purpose:** SPA routing support on Netlify

### 4. Build Output Validation

Always clean build before deploying:

```bash
rm -rf dist
npm run build
npm run preview  # Test locally before deploying
```

## 📋 Deployment Checklist

### Pre-Deployment (Local Testing)

- [ ] Clean build: `rm -rf dist && npm run build`
- [ ] Test preview: `npm run preview`
- [ ] Open http://localhost:4173 and verify:
  - [ ] Home page loads
  - [ ] Navigation works
  - [ ] No console errors (F12)
  - [ ] Assets load correctly (check Network tab)

### Vercel Deployment

1. **Project Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
   - Node Version: 18.x or higher

2. **Environment Variables**
   Required variables:

   ```
   VITE_API_BASE_URL=https://your-backend-url.com/api
   VITE_APP_NAME=Glinax Chatbot
   VITE_APP_VERSION=2.1.0
   ```

3. **Deploy**
   - Push to GitHub: `git push origin main`
   - Vercel auto-deploys from GitHub
   - Or manual: `vercel --prod`

4. **Post-Deployment Verification**
   - [ ] Visit deployment URL
   - [ ] Test all routes
   - [ ] Check console for errors (F12)
   - [ ] Test backend connectivity

### Common Deployment Issues & Fixes

#### Issue 1: 404 on page refresh

**Symptom:** Direct URL navigation returns 404  
**Solution:** Ensure `vercel.json` rewrites are configured (see above)

#### Issue 2: Assets not loading (404)

**Symptom:** JavaScript/CSS files return 404  
**Solution:**

- Verify `base: '/'` in vite.config.ts
- Rebuild: `rm -rf dist && npm run build`
- Check asset paths don't have double slashes

#### Issue 3: CORS errors

**Symptom:** API calls fail with CORS error  
**Solution:** Update backend CORS configuration:

```env
# Backend .env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
FRONTEND_URL=https://your-frontend.vercel.app
```

#### Issue 4: Environment variables not working

**Symptom:** `import.meta.env.VITE_*` is undefined  
**Solution:**

- Add variables in Vercel dashboard
- Redeploy (clear cache and redeploy)
- Variables must start with `VITE_` prefix

## 🔧 Build Process

### Development

```bash
npm run dev
# Runs on http://localhost:5173
```

### Production Build

```bash
npm run build
# Output: dist/ folder
```

### Production Preview

```bash
npm run preview
# Runs on http://localhost:4173
# Tests the production build locally
```

### Build Output Structure

```
dist/
├── index.html           # Entry point
├── assets/
│   ├── index-[hash].js  # Main bundle
│   ├── vendor-[hash].js # Dependencies
│   ├── pages-[hash].js  # Page chunks
│   └── index-[hash].css # Styles
├── manifest.json        # PWA manifest
├── sw.js               # Service worker
└── _redirects          # SPA routing (Netlify)
```

## 🚨 Troubleshooting Production Issues

### Step 1: Check Browser Console

1. Open deployed site
2. Press F12 → Console tab
3. Look for errors:
   - `Failed to load module` → Build issue
   - `CORS error` → Backend config
   - `404 on assets` → Base path issue

### Step 2: Check Network Tab

1. F12 → Network tab
2. Reload page
3. Check:
   - All assets load (200 status)
   - No 404 errors
   - No MIME type mismatches

### Step 3: Test Locally

```bash
cd frontend
rm -rf dist node_modules/.vite
npm install
npm run build
npm run preview
```

If local preview works but Vercel doesn't:

- Check environment variables on Vercel
- Verify build settings
- Check deployment logs

### Step 4: Verify Backend

```bash
# Test backend is accessible
curl https://your-backend-url.com/health

# Should return: OK or { "status": "ok" }
```

## 📊 Performance Optimization

Current build output:

- Total bundle: ~890 KB (optimized)
- Code splitting: ✅ Enabled
- Tree shaking: ✅ Enabled
- Minification: ✅ esbuild

Chunks:

- `vendor.js`: React, React Router, Framer Motion
- `pages.js`: Route components
- `components.js`: UI components
- `hooks.js`: Custom hooks
- `services.js`: API services

## 🔐 Security

Production configuration includes:

- Source maps disabled
- Console logs dropped in production
- Security headers configured
- CORS properly restricted
- Environment variables externalized

## 📝 Maintenance

### Updating Dependencies

```bash
npm update
npm audit fix
npm run build  # Test build still works
```

### Adding New Environment Variables

1. Add to `.env.example`
2. Add to Vercel dashboard
3. Document in this file
4. Redeploy

## 🎓 Key Learnings

1. **Always clean build before deploying**
   - Old dist/ files can cause MIME type errors
   - Vite generates new hash names each build

2. **Test production build locally first**
   - `npm run preview` catches issues before deployment
   - Matches production environment closely

3. **SPA routing requires server config**
   - Vercel/Netlify need rewrites to index.html
   - Without it, direct URL navigation fails

4. **Environment variables are build-time**
   - Vite replaces `import.meta.env.VITE_*` at build time
   - Changes require rebuild and redeploy

## 📞 Support

For deployment issues:

1. Check browser console (F12)
2. Review deployment logs on Vercel
3. Test `npm run preview` locally
4. Verify backend is accessible
5. Check environment variables

---

**Last Updated:** December 21, 2025  
**Status:** ✅ Production Ready  
**Deployment:** Vercel (configured)
