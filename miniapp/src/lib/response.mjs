export function responseData(value) {
 let data=value;
 if(typeof data==='string'){
  try{data=JSON.parse(data)}catch{throw Error('接口未返回有效数据，请检查网络或临时服务地址');}
 }
 if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('接口响应格式无效，请重试');
 return data;
}
export function loginResult(value){
 const data=responseData(value);
 if(typeof data.session!=='string'|| !/^[A-Za-z0-9_-]{43}$/.test(data.session)||!data.user?.id)throw Error('登录响应不完整，请重试或联系管理员');
 return data;
}
