import {isAbsolute} from 'node:path';
export function uatRuntimeConfig(source){
  const required=['CMS_DATABASE_URL','FILES_DIR','IDENTITY_URL','IDENTITY_KEY','PUBLIC_ORIGIN'];
  for(const key of required)if(typeof source[key]!=='string'||!source[key])throw Error('UAT配置缺少 '+key);
  let db,identity,origin;
  try{db=new URL(source.CMS_DATABASE_URL);identity=new URL(source.IDENTITY_URL);origin=new URL(source.PUBLIC_ORIGIN);}catch{throw Error('UAT服务地址格式无效');}
  if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname||db.pathname==='/')throw Error('UAT需要PostgreSQL数据库');
  if(!isAbsolute(source.FILES_DIR))throw Error('FILES_DIR必须为绝对路径');
  if(source.IDENTITY_KEY.length<32)throw Error('IDENTITY_KEY长度不足');
  if(!['http:','https:'].includes(identity.protocol)||identity.username||identity.password||identity.search||identity.hash)throw Error('身份服务地址无效');
  if(identity.protocol==='http:'&&!['127.0.0.1','localhost','[::1]','identity'].includes(identity.hostname))throw Error('HTTP身份服务必须位于本机或内部identity服务');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('PUBLIC_ORIGIN必须是HTTPS站点源地址');
  return Object.freeze({CMS_DATABASE_URL:source.CMS_DATABASE_URL,FILES_DIR:source.FILES_DIR,IDENTITY_URL:source.IDENTITY_URL.replace(/\/$/,''),IDENTITY_KEY:source.IDENTITY_KEY,PUBLIC_ORIGIN:origin.origin});
}
