# Python 3.11 on Debian 11 (Bullseye)
FROM python:3.11-slim-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      gnupg \
      apt-transport-https \
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

# Add Microsoft repository and install ODBC Driver 18
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - && \
    curl https://packages.microsoft.com/config/debian/11/prod.list \
      > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure dynamic linker to find ODBC Driver 18 library
RUN echo "/opt/microsoft/msodbcsql18/lib64" > /etc/ld.so.conf.d/msodbcsql18.conf && \
    ldconfig

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
