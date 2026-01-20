# Render Deployment Guide

## Important: Render Only Supports Linux Containers

Render.com uses Linux hosts, so you **cannot** use Windows Docker containers. Use the Linux Dockerfile (`Dockerfile`) instead.

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **GitHub Repository**: Push your code to GitHub
3. **Database Credentials**: Have your SQL Server connection details ready

## Deployment Steps

### Option 1: Using Render Dashboard (Recommended)

1. **Create New Web Service**:
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Select the repository and branch

2. **Configure Service**:
   - **Name**: `sunbaby-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Context**: `backend`
   - **Build Command**: (Leave empty - handled by Dockerfile)
   - **Start Command**: (Leave empty - handled by Dockerfile)

3. **Set Environment Variables**:
   ```
   PORT=8000
   DB_ENCRYPT=True
   DB_TRUST_SERVER_CERTIFICATE=True
   DB_SERVER=your_sql_server
   DB_NAME=your_database
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_DRIVER=ODBC Driver 17 for SQL Server
   ```

4. **Plan Selection**:
   - Start with **Starter** plan ($7/month)
   - Upgrade if needed

5. **Deploy**: Click "Create Web Service"

### Option 2: Using render.yaml

1. Ensure `render.yaml` is in your repository root
2. In Render Dashboard → New → Blueprint
3. Connect your repository
4. Render will automatically detect `render.yaml` and configure the service

## Post-Deployment

1. **Check Logs**: 
   - Go to your service → Logs
   - Verify the application starts correctly
   - Check for any SSL/TLS errors

2. **Test Connection**:
   - The app should be available at: `https://sunbaby-backend.onrender.com`
   - Check `/docs` endpoint for Swagger UI

3. **Monitor**:
   - Watch logs for database connection issues
   - If you see SSL errors, verify environment variables are set correctly

## Troubleshooting SSL/TLS Issues on Render

If you still encounter "legacy sigalg disallowed" errors on Render:

1. **Verify Environment Variables**:
   - Ensure `DB_ENCRYPT=True`
   - Ensure `DB_TRUST_SERVER_CERTIFICATE=True`

2. **Check Render Logs**:
   - Look for OpenSSL configuration errors
   - Verify ODBC Driver 17 is installed

3. **Alternative Solution** (if issues persist):
   Consider using a connection proxy or updating your SQL Server certificate to use SHA-256

## Notes

- **Free Tier**: Render free tier spins down after inactivity. Consider a paid plan for production
- **Database**: Render also offers managed PostgreSQL. If possible, consider migrating to PostgreSQL
- **SSL Certificate**: Render automatically provides SSL certificates for your service

## Cost Estimation

- **Starter Plan**: $7/month (512MB RAM, 0.5 CPU)
- **Standard Plan**: $25/month (2GB RAM, 1 CPU) - Recommended for production
- **Pro Plan**: $85/month (4GB RAM, 2 CPU) - For high traffic

