"""Run as root on a verified fresh UAT host. Idempotent secret files; no credential output."""
import os,secrets,json,subprocess,pwd
from pathlib import Path

def run(args,**kw):return subprocess.run(args,check=True,**kw)
def psql(sql):run(['sudo','-u','postgres','psql','-v','ON_ERROR_STOP=1','-q'],input=sql,text=True,stdout=subprocess.DEVNULL)
try:pwd.getpwnam('aition')
except KeyError:run(['useradd','--system','--home','/srv/aition','--shell','/usr/sbin/nologin','aition'])
for path in ['/srv/aition/releases','/srv/aition/shared/files','/srv/aition/shared/identity','/srv/aition/shared/backups','/etc/aition','/var/www/acme']:
 Path(path).mkdir(parents=True,exist_ok=True)
run(['chown','-R','aition:aition','/srv/aition'])
run(['chmod','700','/srv/aition/shared','/etc/aition'])
record=Path('/etc/aition/secrets.json')
if record.exists():values=json.loads(record.read_text())
else:
 values={k:secrets.token_hex(32) for k in ['cms_password','identity_password','internal_key','django_key','admin_password']}
 record.write_text(json.dumps(values));record.chmod(0o600)
for role,key in [('aition_cms','cms_password'),('aition_identity','identity_password')]:
 psql("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='"+role+"') THEN CREATE ROLE "+role+" LOGIN PASSWORD '"+values[key]+"'; END IF; END $$;")
for db in ['aition_cms_uat','aition_identity_uat']:
 exists=subprocess.check_output(['sudo','-u','postgres','psql','-tAc',"SELECT 1 FROM pg_database WHERE datname='"+db+"'"]).strip()
 if not exists:run(['sudo','-u','postgres','createdb','--encoding=UTF8','--template=template0',db])
 psql('REVOKE ALL ON DATABASE '+db+' FROM PUBLIC; GRANT CONNECT ON DATABASE '+db+' TO '+('aition_cms' if 'cms' in db else 'aition_identity')+';')
# Identity owns schema for managed Django migrations; runtime does not own the CMS schema.
run(['sudo','-u','postgres','psql','-d','aition_identity_uat','-v','ON_ERROR_STOP=1','-q','-c','ALTER SCHEMA public OWNER TO aition_identity; REVOKE CREATE ON SCHEMA public FROM PUBLIC;'],stdout=subprocess.DEVNULL)
print('UAT directories and dedicated databases ready; secrets retained server-side')
