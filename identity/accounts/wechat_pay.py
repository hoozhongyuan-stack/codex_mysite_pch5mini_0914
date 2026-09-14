"""API v3 cryptographic boundary. Not exposed as a payment callback yet.

DB idempotency, order state reconciliation and refund orchestration must be wired
before enabling online payment. Never infer settlement from client callbacks.
"""
import base64,json,re,time
from cryptography.hazmat.primitives.asymmetric import padding,rsa
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def request_message(method,path,timestamp,nonce,body):
 if method not in ('GET','POST','DELETE') or not isinstance(path,str) or not path.startswith('/v3/') or '\n' in path or '\r' in path:raise ValueError('支付请求格式无效')
 if not re.fullmatch(r'[0-9]{1,12}',str(timestamp)) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',nonce):raise ValueError('支付签名参数无效')
 return f'{method}\n{path}\n{timestamp}\n{nonce}\n'.encode()+body+b'\n'

def sign(key,message):
 if not isinstance(key,rsa.RSAPrivateKey) or key.key_size<2048:raise ValueError('商户私钥必须为RSA 2048位或以上')
 return base64.b64encode(key.sign(message,padding.PKCS1v15(),hashes.SHA256())).decode()

def verify(headers,body,trusted_keys,now=None):
 try:
  h={k.lower():v for k,v in headers.items()};ts=h['wechatpay-timestamp'];nonce=h['wechatpay-nonce'];serial=h['wechatpay-serial']
  if not re.fullmatch(r'[0-9]{1,12}',ts) or abs((time.time() if now is None else now)-int(ts))>300:raise ValueError()
  if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',nonce) or len(body)>1024*1024:raise ValueError()
  key=trusted_keys[serial]
  if not isinstance(key,rsa.RSAPublicKey) or key.key_size<2048:raise ValueError()
  key.verify(base64.b64decode(h['wechatpay-signature'],validate=True),ts.encode()+b'\n'+nonce.encode()+b'\n'+body+b'\n',padding.PKCS1v15(),hashes.SHA256())
 except Exception:raise ValueError('微信支付签名校验失败') from None

def decrypt_resource(resource,key):
 try:
  if len(key)!=32 or resource.get('algorithm')!='AEAD_AES_256_GCM':raise ValueError()
  nonce=resource['nonce'].encode();aad=resource.get('associated_data','').encode()
  if len(nonce)!=12:raise ValueError()
  ciphertext=base64.b64decode(resource['ciphertext'],validate=True)
  if len(ciphertext)>1024*1024:raise ValueError()
  value=json.loads(AESGCM(key).decrypt(nonce,ciphertext,aad))
  if not isinstance(value,dict):raise ValueError()
  return value
 except Exception:raise ValueError('微信支付通知解密失败') from None

def match_payment(value,*,appid,mchid,order,total):
 amount=value.get('amount',{})
 if type(total) is not int or total<1 or value.get('appid')!=appid or value.get('mchid')!=mchid or value.get('out_trade_no')!=order or value.get('trade_state')!='SUCCESS' or not value.get('transaction_id') or type(amount.get('total')) is not int or amount['total']!=total or amount.get('currency')!='CNY':raise ValueError('支付通知与订单不一致')
