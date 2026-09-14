export function checkoutOwnerKey(origin,userId){
  if(userId===undefined||userId===null||String(userId)==='')throw Error('需要已验证的账号身份');
  return 'mini-checkout-draft:'+origin+':user:'+String(userId);
}
// Authentication/network responses do not prove an earlier submission failed.
export function submissionDefinitelyRejected(status){
  return [400,409,422].includes(status);
}
