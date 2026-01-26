FROM python:3.11-slim

# Install dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install RAR
WORKDIR /tmp
# Download RAR 7.12 for Linux x64
RUN curl -O https://www.rarlab.com/rar/rarlinux-x64-712.tar.gz \
    && tar -xzvf rarlinux-x64-712.tar.gz \
    && cp rar/rar /usr/local/bin/ \
    && cp rar/default.sfx /usr/local/lib/ \
    && chmod +x /usr/local/bin/rar \
    && rm -rf rar rarlinux-x64-712.tar.gz

WORKDIR /app

# Install Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
