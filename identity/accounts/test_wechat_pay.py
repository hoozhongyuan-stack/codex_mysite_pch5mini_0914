import base64,json
from django.test import SimpleTestCase
from cryptography.hazmat.primitives.asymmetric import rsa,padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from . import wechat_pay as pay
class PaymentCryptoTests(SimpleTestCase):
 @classmethod
 def setUpClass(cls):super().setUpClass();cls.key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
 def test_request_signature_covers_exact_body(self):
  message=pay.request_message('POST','/v3/pay/transactions/jsapi','1000','nonce',b'{"amount":10}')
  sig=pay.sign(self.key,message);self.key.public_key().verify(base64.b64decode(sig),message,padding.PKCS1v15(),hashes.SHA256())
  with self.assertRaises(Exception):self.key.public_key().verify(base64.b64decode(sig),message+b'x',padding.PKCS1v15(),hashes.SHA256())
 def headers(self,body):return {'Wechatpay-Serial':'trusted','Wechatpay-Timestamp':'1000','Wechatpay-Nonce':'nonce','Wechatpay-Signature':pay.sign(self.key,b'1000\nnonce\n'+body+b'\n')}
 def test_notifications_reject_tamper_unknown_key_and_stale(self):
  body=b'{}';headers=self.headers(body);pay.verify(headers,body,{'trusted':self.key.public_key()},now=1000)
  for h,b,now in [(headers,b'{"x":1}',1000),({**headers,'Wechatpay-Serial':'other'},body,1000),(headers,body,1400)]:
   with self.assertRaises(ValueError):pay.verify(h,b,{'trusted':self.key.public_key()},now=now)
 def test_encrypted_resource_and_amount_guard(self):
  key=b'x'*32;nonce='123456789012';aad='transaction';data={'appid':'app','mchid':'merchant','out_trade_no':'order','trade_state':'SUCCESS','transaction_id':'txn','amount':{'total':100,'currency':'CNY'}}
  resource={'algorithm':'AEAD_AES_256_GCM','nonce':nonce,'associated_data':aad,'ciphertext':base64.b64encode(AESGCM(key).encrypt(nonce.encode(),json.dumps(data).encode(),aad.encode())).decode()}
  got=pay.decrypt_resource(resource,key);pay.match_payment(got,appid='app',mchid='merchant',order='order',total=100)
  for patch in [{'amount':{'total':101,'currency':'CNY'}},{'mchid':'wrong'},{'trade_state':'NOTPAY'},{'amount':{'total':100,'currency':'USD'}}]:
   with self.assertRaises(ValueError):pay.match_payment({**got,**patch},appid='app',mchid='merchant',order='order',total=100)
  with self.assertRaises(ValueError):pay.decrypt_resource({**resource,'associated_data':'changed'},key)
