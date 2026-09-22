FROM python:3.14-slim AS runner
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY identity/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY identity /app/identity
RUN mkdir -p /data/identity
WORKDIR /app/identity
EXPOSE 3002
CMD ["gunicorn", "--bind", "0.0.0.0:3002", "--workers", "2", "--threads", "4", "--timeout", "120", "config.wsgi:application"]
