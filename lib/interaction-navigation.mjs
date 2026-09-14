/** Preserve browser handling for authentication, files, external URLs and anchors.
 * @param {{href?:string,target?:string,download?:unknown}} options
 */
export function clientNavigation({href,target,download}) {
  if(typeof href!=='string'||!/^\/(?!\/)/.test(href)||href.includes('#'))return false;
  if((target&&target!=='_self')||(download!==undefined&&download!==false))return false;
  const url=new URL(href,'https://internal.invalid');
  if(/^\/(api|preview)(\/|$)/.test(url.pathname))return false;
  if(/^\/(admin\/login|login)(\/|$)/.test(url.pathname))return false;
  if(/\/account$/.test(url.pathname)&&['mode','returnTo','oauthLinked','oauthError'].some(key=>url.searchParams.has(key)))return false;
  return true;
}
