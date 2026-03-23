@echo off
echo 🚀 Student Emotional Analytics - Deployment Helper
echo.

echo Step 1: Building React app...
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd '%~dp0'; npm run build"
if %errorlevel% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)
echo ✅ Build completed!

echo.
echo Step 2: Deploying to Firebase Hosting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd '%~dp0'; firebase deploy --project emotion-95d44"
if %errorlevel% neq 0 (
    echo ❌ Firebase deployment failed!
    pause
    exit /b 1
)
echo ✅ Firebase deployment completed!

echo.
echo 🎉 Frontend deployed successfully!
echo 🌐 Your app is live at: https://emotion-95d44.web.app
echo.
echo 📋 Next steps:
echo 1. Push your code to GitHub
echo 2. Deploy backend to Render.com (see DEPLOYMENT.md)
echo 3. Update API endpoints to point to Render.com backend
echo.
pause