import json
import os
import re
import tempfile
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.validators import validate_email
CONFIG = settings.DATA_DIR / 'smtp.json'
def read_config():
    return json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
def public_config():
    config = read_config()
    return {**{k:v for k,v in config.items() if k != 'password'}, 'passwordConfigured': bool(config.get('password'))}
def save_config(data):
    old = read_config()
    host = str(data.get('host','')).strip()
    if not re.fullmatch(r'[a-zA-Z0-9.-]{1,253}',host):
        raise ValueError('SMTP 主机格式无效')
    port = int(data.get('port',465))
    if port not in (465,587): raise ValueError('仅支持 465 SSL 或 587 STARTTLS')
    sender = str(data.get('sender','')).strip()
    validate_email(sender)
    username = str(data.get('username','')).strip()
    if not username or len(username)>254 or any(c in username for c in '\r\n'): raise ValueError('SMTP 账号无效')
    password = data.get('password') or old.get('password','')
    if not isinstance(password,str) or not password or len(password)>1000: raise ValueError('请填写 SMTP 授权码')
    name = str(data.get('senderName','GEO Studio')).strip()
    if len(name)>100 or any(c in name for c in '\r\n<>'): raise ValueError('发件人名称无效')
    config = {'host':host,'port':port,'sender':sender,'username':username,'password':password,'senderName':name,'enabled':data.get('enabled') is True}
    fd, path = tempfile.mkstemp(dir=settings.DATA_DIR)
    try:
        with os.fdopen(fd,'w') as out: json.dump(config,out)
        os.replace(path, CONFIG)
    finally:
        if os.path.exists(path): os.unlink(path)
    return public_config()
def send(to, subject, body, html=None):
    config = read_config()
    if not config.get('enabled') or not config.get('password'): raise ValueError('请先在后台配置并启用 SMTP 邮件服务')
    connection = get_connection('accounts.smtp_backend.VerifiedSMTPBackend',host=config['host'],port=config['port'],username=config['username'],password=config['password'],use_ssl=config['port']==465,use_tls=config['port']==587,timeout=15)
    email = EmailMultiAlternatives(subject,body,f"{config['senderName']} <{config['sender']}>",[to],connection=connection)
    if html:
        email.attach_alternative(html, 'text/html')
    if email.send()!=1: raise RuntimeError('mail unavailable')
