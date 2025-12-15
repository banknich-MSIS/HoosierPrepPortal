# Create data directories
New-Item -ItemType Directory -Force -Path ".\data\backend" | Out-Null
New-Item -ItemType Directory -Force -Path ".\data\uploads" | Out-Null
New-Item -ItemType Directory -Force -Path ".\data\logs" | Out-Null

Write-Host "Starting Hoosier Prep Portal with Docker..." -ForegroundColor Green

# Build and start containers
docker-compose up -d --build

Write-Host ""
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check status
docker-compose ps

Write-Host ""
Write-Host "Services should be available at:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Yellow
Write-Host "Or run: .\docker-logs.ps1" -ForegroundColor Yellow
Write-Host "To stop: docker-compose down" -ForegroundColor Yellow
Write-Host "Or run: .\docker-stop.ps1" -ForegroundColor Yellow

