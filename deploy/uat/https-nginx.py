import sys,subprocess
from pathlib import Path
host=sys.argv[1]
if not all(c.isalnum() or c in '.-' for c in host):raise ValueError('Invalid host')
Path('/etc/nginx/sites-available/aition-uat').write_text('''map $uri $aition_robots {
 default "";
 ~^/api/media/ "";
 ~^/(api|admin|preview|login)(/|$) "noindex, nofollow, noarchive";
 ~^/(zh|en)/(account|orders|cart)(/|$) "noindex, nofollow, noarchive";
 ~^/(zh|en)/(events|videos)/mine(/|$) "noindex, nofollow, noarchive";
}
server {
 listen 80;
 server_name HOST;
 location ^~ /.well-known/acme-challenge/ {root /var/www/acme;}
 location / {return 301 https://HOST$request_uri;}
}
server {
 listen 443 ssl;
 server_name HOST;
 ssl_certificate /etc/letsencrypt/live/HOST/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/HOST/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 client_max_body_size 32m;
 add_header X-Robots-Tag $aition_robots always;
 location ~ /\\. {deny all;}
 location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host HOST;
  proxy_set_header X-Forwarded-Host HOST;
  proxy_set_header X-Forwarded-Proto https;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header CF-Connecting-IP $remote_addr;
  proxy_set_header oai-authenticated-user-id "";
  proxy_set_header oai-authenticated-user-email "";
  proxy_set_header oai-authenticated-user-full-name "";
  proxy_read_timeout 120s;
  proxy_buffering off;
 }
}
'''.replace('HOST',host))
subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
hook=Path('/etc/letsencrypt/renewal-hooks/deploy/reload-nginx');hook.write_text('#!/bin/sh\nnginx -t && systemctl reload nginx\n');hook.chmod(0o755)
