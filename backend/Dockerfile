# Python 3.11 on Debian 12 (Bookworm) - OpenSSL 3.0 for better TLS compatibility
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      gnupg \
      apt-transport-https \
      openssl \
      unixodbc \
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

# Add Microsoft repository and install ODBC Driver 17
# Driver 17 has better compatibility with legacy SQL Server certificates
# Debian 12 uses modern GPG keyring approach (apt-key is deprecated)
RUN mkdir -p /etc/apt/keyrings && \
    curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor \
        | tee /etc/apt/keyrings/microsoft-prod.gpg > /dev/null && \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure dynamic linker to find ODBC Driver 17 library
RUN echo "/opt/microsoft/msodbcsql17/lib64" > /etc/ld.so.conf.d/msodbcsql17.conf && \
    ldconfig

# Configure OpenSSL 3.0 to allow legacy signature algorithms (required for SQL Server certificates)
# Driver 17 uses system OpenSSL, so we configure it to support legacy signature algorithms
RUN if grep -q "^\[system_default_sect\]" /etc/ssl/openssl.cnf; then \
        sed -i '/^\[system_default_sect\]/,/^\[/ s/^\(CipherString = DEFAULT@SECLEVEL=\)2/\11/' /etc/ssl/openssl.cnf; \
    else \
        echo "" >> /etc/ssl/openssl.cnf && \
        echo "[system_default_sect]" >> /etc/ssl/openssl.cnf && \
        echo "MinProtocol = TLSv1.2" >> /etc/ssl/openssl.cnf && \
        echo "CipherString = DEFAULT@SECLEVEL=1" >> /etc/ssl/openssl.cnf; \
    fi

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start app
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
