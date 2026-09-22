FROM python:3.14-slim AS runner
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g; s|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources
RUN apt-get update \
  && apt-get install -y -o Acquire::http::Timeout=30 -o Acquire::Retries=3 --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY identity/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r /tmp/requirements.txt
COPY identity /app/identity
RUN mkdir -p /data/identity
WORKDIR /app/identity
EXPOSE 3002
CMD ["gunicorn", "--bind", "0.0.0.0:3002", "--workers", "2", "--threads", "4", "--timeout", "120", "config.wsgi:application"]
