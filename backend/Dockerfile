# Use Python 3.11 on Debian 11 (Bullseye) – compatible with msodbcsql17 packages
FROM python:3.11-slim-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install base system dependencies (including WeasyPrint deps and unixodbc-dev)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      gnupg \
      apt-transport-https \
      unixodbc-dev \
      ca-certificates \
      # WeasyPrint dependencies
      libpango-1.0-0 \
      libpangoft2-1.0-0 \
      libfontconfig1 \
      libcairo2 \
      libgdk-pixbuf2.0-0 \
      libffi-dev \
      shared-mime-info && \
    rm -rf /var/lib/apt/lists/*

# Add Microsoft repository for SQL Server ODBC driver 17 and install it
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - && \
    curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Optional: Copy SQL Server certificate if available
# Uncomment and provide certificate file to enable proper SSL validation
# COPY sqlserver-cert.pem /usr/local/share/ca-certificates/sqlserver-cert.crt
# RUN update-ca-certificates

# Expose port (Render will set PORT env var)
EXPOSE 8000

# Use PORT environment variable (Render provides this)
# Default to 8000 if not set
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

