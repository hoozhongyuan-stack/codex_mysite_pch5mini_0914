import { identity } from './identity';
import { database } from './server';
export async function publicExtras() {
  const db = database();
  const [nav, cats, pols] = await Promise.all([
    db.prepare('SELECT * FROM navigation_items').all<any>(),
    db.prepare('SELECT * FROM categories').all<any>(),
    db
      .prepare(
        'SELECT kind,published,version,updated_at FROM policies WHERE published IS NOT NULL',
      )
      .all<any>(),
  ]);
  const events=await Promise.all(nav.results.map((r:any)=>JSON.parse(r.data)).filter((r:any)=>r.targetType==='event'&&r.enabled).map(async(r:any)=>{try{return (await identity('marketing-detail',{id:r.targetId})).event}catch{return null}}));
  return {
    events:events.filter(Boolean),
    navigation: nav.results
      .map((r) => ({ ...JSON.parse(r.data), id: r.id }))
      .filter((r) => r.enabled)
      .sort((a, b) => a.sort - b.sort),
    categories: cats.results.map((r) => ({
      ...JSON.parse(r.data),
      id: r.id,
      parent_id: r.parent_id,
    })),
    policies: pols.results.map((r) => ({
      ...JSON.parse(r.published),
      version: r.version,
      updatedAt: r.updated_at,
    })),
  };
}
export function navLinks(extra: any, all: any[], lang: string) {
  return extra.navigation.flatMap((n: any) => {
    if(n.targetType==='pointsMall')return [{...n,href:`/${lang}/points-shop`}];
    if(n.targetType==='videoCatalog')return [{...n,href:`/${lang}/videos`}];
    if(n.targetType==='event'){return extra.events?.some((e:any)=>e.id===n.targetId)?[{...n,href:`/${lang}/events/${n.targetId}`}]:[]}
    const isCategory = n.targetType.endsWith('Category');
    const target = (isCategory ? extra.categories : all).find(
      (r: any) => r.id === n.targetId,
    );
    if (!target) return [];
    return [
      {
        ...n,
        href: `/${lang}/${isCategory ? 'categories/' + target.id : target.kind + '/' + target.slug}`,
      },
    ];
  });
}
