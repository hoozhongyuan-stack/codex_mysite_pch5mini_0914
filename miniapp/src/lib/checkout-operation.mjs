export function checkoutOperation(session,ownerKey,current,request){
  const assertCurrent=()=>{if(current()!==session)throw Error('登录状态已变化，请重新核对订单');};
  return Object.freeze({session,ownerKey,assertCurrent,async request(path,data){
    assertCurrent();const result=await request(path,data,session);assertCurrent();return result;
  }});
}
