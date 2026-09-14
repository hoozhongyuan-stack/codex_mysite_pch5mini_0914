import sys,subprocess
from pathlib import Path
host=sys.argv[1]
if not all(c.isalnum() or c in '.-' for c in host):raise ValueError('Invalid host')
Path('/etc/nginx/sites-available/aition-uat').write_text('''server {
 listen 80;
 server_name HOST;
 add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
 location ^~ /.well-known/acme-challenge/ {root /var/www/acme;}
 location / {default_type text/plain; return 503 "UAT deployment in progress";}
}
'''.replace('HOST',host))
p=Path('/etc/nginx/sites-enabled/aition-uat')
if not p.exists():p.symlink_to('/etc/nginx/sites-available/aition-uat')
subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
