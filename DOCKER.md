# Docker Deployment Guide

## Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 2GB free disk space

## Quick Start

1. **Build and start services:**
   ```powershell
   .\docker-start.ps1
   ```

2. **Access the application:**
   - Frontend: http://localhost
   - Backend API Docs: http://localhost:8000/docs

3. **View logs:**
   ```powershell
   .\docker-logs.ps1
   # Or for specific service:
   .\docker-logs.ps1 backend
   .\docker-logs.ps1 frontend
   ```

4. **Stop services:**
   ```powershell
   .\docker-stop.ps1
   ```

## Manual Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Remove volumes (WARNING: deletes database and uploads)
docker-compose down -v
```

## Data Persistence

- Database: `./data/backend/exam.db`
- Uploads: `./data/uploads/`
- Logs: `./data/logs/backend.log`

These directories are persisted as Docker volumes. Your data will survive container restarts.

## Environment Variables

You can customize the setup by creating a `.env` file in the root directory:

```bash
VITE_API_URL=http://localhost:8000/api
DB_DIR=./data
FRONTEND_URL=http://localhost
```

Or modify `docker-compose.yml` directly to change environment variables.

## Troubleshooting

### Port Already in Use
If ports 80 or 8000 are in use, modify `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "8080:80"      # Frontend on 8080 instead of 80
  backend:
    ports:
      - "8001:8000"    # Backend on 8001 instead of 8000
```

Then update `VITE_API_URL` in docker-compose.yml to match:
```yaml
frontend:
  build:
    args:
      - VITE_API_URL=http://localhost:8001/api
```

### Database Issues
If database doesn't persist, check volume mounts:
```bash
docker-compose down
docker volume ls
# Ensure data directories exist
ls -la ./data/
```

### Build Failures
Clear Docker cache and rebuild:
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Frontend Can't Reach Backend
1. Check that backend is healthy:
   ```bash
   docker-compose ps
   # Backend should show "healthy"
   ```

2. Check backend logs:
   ```bash
   .\docker-logs.ps1 backend
   ```

3. Verify CORS settings in `StudyTool/server/main.py` include your frontend URL

### Container Won't Start
1. Check Docker logs:
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. Verify all required files exist:
   - `StudyTool/server/Dockerfile`
   - `StudyTool/web/Dockerfile`
   - `StudyTool/web/nginx.conf`
   - `docker-compose.yml`

3. Check disk space:
   ```bash
   docker system df
   ```

## Development vs Production

This setup uses production builds. For development:
- Use `start.ps1` for local development with hot reload
- Use Docker for production/staging deployments

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (nginx:80)    │  ← Serves React app
└────────┬────────┘
         │
         │ API calls
         │
┌────────▼────────┐
│    Backend      │
│  (FastAPI:8000) │  ← API server
└─────────────────┘
         │
         │
┌────────▼────────┐
│   Volumes       │
│  - Database     │
│  - Uploads      │
│  - Logs         │
└─────────────────┘
```

## Updating the Application

After making code changes:

1. **Rebuild and restart:**
   ```powershell
   docker-compose up -d --build
   ```

2. **Or rebuild specific service:**
   ```powershell
   docker-compose build backend
   docker-compose up -d backend
   ```

## Backup and Restore

Your data is stored in `./data/` directory. To backup:
```powershell
# Stop containers
.\docker-stop.ps1

# Copy data directory
Copy-Item -Path ".\data" -Destination ".\data-backup" -Recurse

# Restore (after stopping containers)
Remove-Item -Path ".\data" -Recurse
Copy-Item -Path ".\data-backup" -Destination ".\data" -Recurse
```

## Production Considerations

For production deployments, consider:

1. **SSL/TLS**: Add reverse proxy (nginx/traefik) with SSL certificates
2. **Database**: Consider PostgreSQL instead of SQLite for better performance
3. **Environment Variables**: Use secrets management
4. **Monitoring**: Add health checks and monitoring tools
5. **Scaling**: Use Docker Swarm or Kubernetes for multi-instance deployments

