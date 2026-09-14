import json,os,sys
from pathlib import Path
from urllib.parse import urlsplit
domain=sys.argv[1]
if not domain or urlsplit('https://'+domain).hostname!=domain:raise ValueError('Invalid domain')
s=json.loads(Path('/etc/aition/secrets.json').read_text())
def write(name,values):
 p=Path('/etc/aition')/name;p.write_text(''.join(k+'='+v+'\n' for k,v in values.items()));p.chmod(0o600)
write('web.env',{'NODE_ENV':'production','VINEXT_TRUSTED_HOSTS':domain,'HOST':'127.0.0.1','PORT':'3001','CMS_DATABASE_URL':'postgresql://aition_cms:'+s['cms_password']+'@127.0.0.1/aition_cms_uat','FILES_DIR':'/srv/aition/shared/files','IDENTITY_URL':'http://127.0.0.1:3002','IDENTITY_KEY':s['internal_key'],'PUBLIC_ORIGIN':'https://'+domain})
write('identity.env',{'IDENTITY_ENV':'uat','IDENTITY_DATA_DIR':'/srv/aition/shared/identity','IDENTITY_DATABASE_URL':'postgresql://aition_identity:'+s['identity_password']+'@127.0.0.1/aition_identity_uat','IDENTITY_SECRET_KEY':s['django_key'],'IDENTITY_INTERNAL_KEY':s['internal_key'],'PUBLIC_ORIGIN':'https://'+domain,'IDENTITY_ALLOWED_HOSTS':'localhost,127.0.0.1','INITIAL_ADMIN_USERNAME':'uat_admin','INITIAL_ADMIN_EMAIL':'uat-admin@'+domain,'INITIAL_ADMIN_PASSWORD':s['admin_password']})
print('Private UAT environment files written')
