"""Load private env without shell interpolation or credential output."""
import os,sys,subprocess,pwd
from pathlib import Path
name=sys.argv[1]
if name not in ('web','identity'):raise ValueError('Invalid service')
env=os.environ.copy()
for line in (Path('/etc/aition')/(name+'.env')).read_text().splitlines():
 if line and not line.startswith('#'):
  key,value=line.split('=',1);env[key]=value
account=pwd.getpwnam('aition')
def drop():os.initgroups('aition',account.pw_gid);os.setgid(account.pw_gid);os.setuid(account.pw_uid)
subprocess.run(sys.argv[2:],env=env,preexec_fn=drop,check=True)
