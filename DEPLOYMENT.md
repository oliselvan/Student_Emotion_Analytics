# Student Emotional Analytics - Deployment Guide

## 🚀 Deploy to Render.com (Free)

### Step 1: Prepare Your Code
1. **Push to GitHub** (required for Render.com)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

### Step 2: Deploy Backend to Render.com
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `student-emotional-analytics-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 3: Set Environment Variables
In Render.com dashboard, go to your service → Environment → Add the following:

```
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key_here
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=SLP Support <your_email@example.com>
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"emotion-95d44",...}
```

### Step 4: Deploy
- Click "Create Web Service"
- Wait for deployment (5-10 minutes)
- Note the URL: `https://your-service-name.onrender.com`

### Step 5: Update Frontend API Calls
In your deployed Firebase Hosting app, the API calls will fail because they're pointing to `/api/*` but need to point to your Render.com backend.

**You have two options:**

#### Option A: Proxy API calls through Firebase Hosting
Add this to your `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "/api/**",
        "function": {
          "functionId": "proxy",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

#### Option B: Update API base URL in production
Modify your frontend to use the Render.com URL in production.

---

## 🔧 Troubleshooting

### Backend Not Starting
- Check Render.com logs for errors
- Ensure all environment variables are set
- Verify Firebase service account JSON is valid

### API Calls Failing
- Check CORS settings in your Express server
- Verify the Render.com URL is accessible
- Check Firebase Hosting rewrites

### Database Issues
- Ensure Firestore is enabled in your Firebase project
- Check service account permissions

---

## 📝 Current Status
- ✅ Frontend deployed to Firebase Hosting: https://emotion-95d44.web.app
- ⏳ Backend needs deployment to Render.com
- ⏳ API endpoints need to be connected