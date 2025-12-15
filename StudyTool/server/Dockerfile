# Multi-stage build for FastAPI backend
FROM python:3.11-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY server/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Install system dependencies for file processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code (context is StudyTool/, so copy server/ directory)
# Copy everything from server directory recursively
COPY server/ ./server/
# Verify files were copied
RUN ls -la ./server/ && echo "Files copied successfully"

# Create directories for database and uploads
RUN mkdir -p /app/data /app/uploads

# Set PYTHONPATH so Python can find the server module
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# Set working directory to where server code is
WORKDIR /app

# Run the application from /app directory
# Since server code is at /app/server/, we need to add /app to PYTHONPATH or run from /app
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]

