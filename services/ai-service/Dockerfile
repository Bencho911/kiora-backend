FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN addgroup --system appgroup && adduser --system --group appuser

# Copy application code
COPY . .

# Set permissions
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3008

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3008"]
