import { identity, visitorSession } from '@/lib/identity';
import { safeShopReturn } from '@/lib/shop-navigation.mjs';
import { limited } from '@/lib/server';
export async function GET(request: Request, { params }: { params: Promise<{provider:string}> }) {
  const url = new URL(request.url);
  const headers = new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  try {
    const {provider} = await params;
    if (!['google','facebook','wechat'].includes(provider)) throw Error('未知登录渠道');
    await limited('oauth-callback:'+(request.headers.get('cf-connecting-ip')||'local'),30);
    const browser = request.headers.get('cookie')?.match(/(?:^|;\s*)geo_social=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    if (!browser || url.searchParams.has('error')) throw Error('授权已取消或会话已过期，请重新登录');
    const result = await identity('oauth-finish',{provider,browser,session:visitorSession(request),state:url.searchParams.get('state'),code:url.searchParams.get('code')});
    headers.append('Set-Cookie',`geo_visitor=${result.session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200${url.protocol==='https:'?'; Secure':''}`);
    headers.set('Location',safeShopReturn(result.returnTo) || `/${result.lang==='en'?'en':'zh'}/account${result.linked?'?section=settings&oauthLinked=1':''}`);
  } catch {
    headers.set('Location','/zh/account?oauthError=1');
  }
  return new Response(null,{status:303,headers});
}
