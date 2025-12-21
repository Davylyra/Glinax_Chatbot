# DEPLOYMENT TROUBLESHOOTING GUIDE

## Blank Page After Deployment? Here's how to fix it:

### 1. Check Browser Console

Open your deployed site and press F12 to open Developer Tools. Look for errors in the Console tab.

**Common Errors:**

- `Failed to fetch` → Backend URL issue (see #2)
- `404 Not Found` on assets → Build configuration issue (see #3)
- `CORS error` → Backend CORS configuration (see #4)
- White screen + no errors → React error boundary issue (see #5)

### 2. Set Environment Variables on Deployment Platform

#### For Netlify:

1. Go to Site settings → Environment variables
2. Add: `VITE_API_BASE_URL` = `https://your-backend-url.com/api`
3. Redeploy the site

#### For Vercel:

1. Go to Project Settings → Environment Variables
2. Add: `VITE_API_BASE_URL` = `https://your-backend-url.com/api`
3. Redeploy

#### For GitHub Pages:

- Update `frontend/.env.production` with your backend URL
- Commit and push changes

### 3. Verify Build Output

```bash
cd frontend
npm run build
# Check that dist/index.html exists and contains your app
```

### 4. Test Locally Before Deploy

```bash
cd frontend
npm run build
npm run preview
# Visit http://localhost:4173 - should work like production
```

### 5. Common Fixes

#### Fix 1: Update Backend CORS

Add your frontend URL to backend `.env`:

```env
FRONTEND_URL=https://your-frontend-url.netlify.app
ALLOWED_ORIGINS=https://your-frontend-url.netlify.app,http://localhost:5173
```

Restart backend after changes.

#### Fix 2: Create .env.production

```bash
cd frontend
cp .env.production.example .env.production
# Edit .env.production with your production backend URL
```

#### Fix 3: Rebuild and Redeploy

```bash
cd frontend
rm -rf dist node_modules
npm install
npm run build
# Deploy the dist/ folder
```

#### Fix 4: Check Deployment Settings

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18 or higher

### 6. Platform-Specific Issues

#### Netlify

- Ensure `_redirects` file exists in `public/` folder ✅ (already added)
- Check build logs for errors
- Verify environment variables are set

#### Vercel

- Ensure `vercel.json` exists ✅ (already added)
- Check deployment logs
- Verify environment variables

#### GitHub Pages

- Base path must be set correctly in vite.config.ts
- For `username.github.io/repo-name`, set `base: '/repo-name/'`

### 7. Quick Diagnostic Commands

```bash
# Check if build succeeds
cd frontend && npm run build

# Check if preview works locally
npm run preview

# Check environment variables
cat .env.production  # or .env

# View build output
ls -la dist/
```

### 8. Still Having Issues?

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5)
3. **Check deployment logs** on your platform
4. **Verify backend is running** by visiting its health endpoint
5. **Test API directly** in browser: `https://your-backend/api/health`

### 9. Backend Deployment Checklist

Make sure your backend is also deployed and accessible:

```bash
# Test backend health endpoint
curl https://your-backend-url.com/health

# Should return: OK
```

If backend is not deployed yet:

1. Deploy backend first (Railway, Heroku, DigitalOcean, etc.)
2. Get the backend URL
3. Update frontend environment variable
4. Redeploy frontend

### 10. Contact Support

If none of the above works:

1. Share browser console errors
2. Share deployment logs
3. Share your deployment platform (Netlify/Vercel/etc.)
4. Confirm backend URL is accessible

---

## Quick Fix Checklist

- [ ] Added `VITE_API_BASE_URL` to deployment platform
- [ ] Backend is deployed and accessible
- [ ] Backend CORS allows frontend domain
- [ ] `_redirects` file exists (for Netlify)
- [ ] `vercel.json` exists (for Vercel)
- [ ] Build command is `npm run build`
- [ ] Publish directory is `dist`
- [ ] Cleared browser cache and hard refreshed
- [ ] Checked browser console for errors
- [ ] Tested `npm run preview` locally
