export function publicRobots(origin){
 const privatePaths=['/admin','/login','/preview','/api/','/?',...['zh','en'].flatMap(l=>['account','orders','cart','events/mine','videos/mine'].map(p=>`/${l}/${p}`))];
 return ['User-agent: *','Allow: /','Allow: /api/media/',...privatePaths.map(p=>'Disallow: '+p),'Sitemap: '+origin+'/sitemap.xml',''].join('\n');
}
function attr(tag,name){const re=new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i');return tag.match(re)?.[1]||'';}
export function inspectPublicPage({path,status,robots='',html=''}){
 const metas=html.match(/<meta\b[^>]*>/gi)||[],links=html.match(/<link\b[^>]*>/gi)||[];
 const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
 const description=attr(metas.find(t=>attr(t,'name').toLowerCase()==='description')||'','content');
 const canonical=attr(links.find(t=>attr(t,'rel')==='canonical')||'','href');
 const alternates=links.filter(t=>attr(t,'rel')==='alternate'&&attr(t,'hreflang')).length;
 const metaRobots=attr(metas.find(t=>attr(t,'name').toLowerCase()==='robots')||'','content');
 const scripts=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 const schemas=[];let invalid=false;for(const s of scripts){try{schemas.push(JSON.parse(s[1]));}catch{invalid=true;}}
 const issues=[...(status!==200?['HTTP '+status]:[]),...(/noindex|none/i.test(robots+' '+metaRobots)?['禁止索引']:[]),...(!title?['缺少标题']:[]),...(!description?['缺少描述']:[]),...(!canonical?['缺少规范地址']:[]),...(!alternates?['缺少语言对应链接']:[]),...(!/<h1\b/i.test(html)?['缺少主标题']:[]),...(!scripts.length?['缺少结构化数据']:[]),...(invalid?['结构化数据无效']:[])];
 return {path,status,title,description,canonical,alternates,schemaTypes:schemas.flatMap(s=>[s['@type']||'未标明类型']),issues};
}
const xml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function sitemapXml(origin,entries){
 const rows=[...new Map(entries.filter(e=>!/^\/(account|orders|cart)(\/|$)|^\/(events|videos)\/mine(?:\/|$)/.test(e.path)).map(e=>[e.path,e])).values()];
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+['zh','en'].flatMap(lang=>rows.map(e=>'<url><loc>'+xml(origin+'/'+lang+e.path)+'</loc>'+ (e.updated&&Number.isFinite(Date.parse(e.updated))?'<lastmod>'+new Date(e.updated).toISOString()+'</lastmod>':'')+['zh','en'].map(l=>'<xhtml:link rel="alternate" hreflang="'+(l==='zh'?'zh-CN':'en')+'" href="'+xml(origin+'/'+l+e.path)+'"/>').join('')+'</url>')).join('')+'</urlset>';
}
