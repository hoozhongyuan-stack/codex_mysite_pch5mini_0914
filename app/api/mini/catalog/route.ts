import { validateRich } from '@/lib/cms-domain.mjs';
import { miniRichNodes } from '@/lib/mini-content.mjs';
import { database, fail, HttpError } from '@/lib/server';
import { channelState } from '@/lib/channel-store';
function card(row: any, detail = false) {
  const d = JSON.parse(row.data),
    variants = (d.trade?.variants || []).filter((v: any) => v.enabled);
  const prices = variants
    .map((v: any) => v.priceMinor)
    .filter(Number.isSafeInteger);
  const points = variants
    .map((v: any) => v.pointsPrice)
    .filter((v: any) => Number.isSafeInteger(v) && v > 0);
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: d.titleZh,
    summary: d.summaryZh || '',
    imageId: d.imageId || d.imageIds?.[0] || '',
    price: prices.length ? Math.min(...prices) : null,
    points:
      d.trade?.redemptionEnabled && points.length ? Math.min(...points) : null,
    currency: d.trade?.currency || 'CNY',
    categoryId: d.categoryId || '',
    ...(detail
      ? {
          body: d.bodyZh || '',
          richNodes: d.richZh ? miniRichNodes(validateRich(d.richZh)) : [],
          author: d.author || '',
          publishedAt: d.publishedAt || null,
          imageIds: d.imageIds || [],
          spu: d.spu || '',
          variants: variants.map((v: any) => ({
            key: v.key,
            label: (d.trade?.specs || []).flatMap((s:any)=>s.values.filter((value:any)=>v.key.split('~').includes(value.id)).map((value:any)=>s.nameZh+'：'+value.nameZh)).join(' / ') || '默认规格',
            priceMinor: v.priceMinor,
            pointsPrice: v.pointsPrice,
          })),
          specs: (d.trade?.specs || []).map((s: any) => ({
            name: s.nameZh,
            values: s.values.map((v: any) => v.nameZh),
          })),
        }
      : {}),
  };
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams,
      kind = query.get('kind') || 'products',
      id = query.get('id');
    if (!['products', 'articles', 'points'].includes(kind))
      throw new HttpError(400, '内容类型无效');
    const db = database(),
      base =
        " FROM contents WHERE status='published' AND json_extract(data,'$.channels.mini')=1 AND kind=?",
      actual = kind === 'articles' ? 'articles' : 'products';
    if (id) {
      const row = await db
        .prepare('SELECT *' + base + ' AND id=?')
        .bind(actual, id)
        .first<any>();
      if (!row) throw new HttpError(404, '内容未开放');
      let item=card(row,true);
      if(actual==='products') {
        const data=JSON.parse(row.data), trade=data.trade||{};
        const held=(await db.prepare("SELECT i.variant,COALESCE(SUM(i.quantity),0) AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review') GROUP BY i.variant").bind(row.id).all<any>()).results;
        const total=held.reduce((sum:number,r:any)=>sum+r.quantity,0);
        const variants=(item.variants||[]).map((v:any)=>{
          const source=(trade.variants||[]).find((r:any)=>r.key===v.key);
          const stock=trade.inventoryMode==='variants'?source?.inventory:trade.inventory;
          const occupied=trade.inventoryMode==='variants'?(held.find((r:any)=>r.variant===v.key)?.quantity||0):total;
          return {...v,available:Number.isSafeInteger(stock)?Math.max(0,stock-occupied):null};
        });
        item={...item,variants};
      }
      return Response.json(
        { item },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (query.get('featured') === '1') {
      const ids = (await channelState()).published?.mini?.featuredIds || [];
      if (!ids.length) return Response.json({ rows: [] });
      const list = await db
        .prepare(
          'SELECT *' +
            base +
            ' AND id IN (' +
            ids.map(() => '?').join(',') +
            ')',
        )
        .bind(actual, ...ids)
        .all<any>();
      return Response.json(
        {
          rows: ids
            .map((id: string) => list.results.find((r: any) => r.id === id))
            .filter(Boolean)
            .map((r: any) => card(r)),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const page = Math.max(1, Math.min(10000, Number(query.get('page')) || 1)),
      q = (query.get('q') || '').slice(0, 100),
      category = (query.get('category') || '').slice(0, 80);
    const clause =
      base +
      " AND (?='' OR instr(lower(COALESCE(json_extract(data,'$.titleZh'),'')),lower(?))>0 OR instr(lower(COALESCE(json_extract(data,'$.spu'),'')),lower(?))>0) AND (?='' OR json_extract(data,'$.categoryId')=? OR json_extract(data,'$.categoryId') IN(SELECT id FROM categories WHERE parent_id=?))" +
      (kind === 'points'
        ? " AND json_extract(data,'$.trade.redemptionEnabled')=1 AND EXISTS (SELECT 1 FROM json_each(contents.data,'$.trade.variants') v WHERE json_extract(v.value,'$.enabled')=1 AND json_extract(v.value,'$.pointsPrice')>0)"
        : '');
    const args = [actual, q, q, q, category, category, category];
    const count = await db
      .prepare('SELECT COUNT(*) AS total' + clause)
      .bind(...args)
      .first<any>();
    const pointsOrder="(SELECT MIN(CAST(json_extract(v.value,'$.pointsPrice') AS INTEGER)) FROM json_each(contents.data,'$.trade.variants') v WHERE json_extract(v.value,'$.enabled')=1 AND json_extract(v.value,'$.pointsPrice')>0)";
    const sort=query.get('sort');
    const order=kind==='points'&&['points_asc','points_desc'].includes(sort||'')?pointsOrder+(sort==='points_desc'?' DESC':' ASC')+', id ASC':kind==='points'?"COALESCE(json_extract(data,'$.trade.redemptionSort'),0) ASC, updated_at DESC, id ASC":'updated_at DESC, id ASC';
    const rows = await db
      .prepare(
        'SELECT *' + clause + ' ORDER BY '+order+' LIMIT 24 OFFSET ?',
      )
      .bind(...args, (Math.floor(page) - 1) * 24)
      .all<any>();
    const categories = await db
      .prepare('SELECT id,parent_id,data FROM categories WHERE kind=?')
      .bind(actual)
      .all<any>();
    return Response.json(
      {
        rows: rows.results.map((r) => card(r)),
        page: Math.floor(page),
        pages: Math.max(1, Math.ceil(count.total / 24)),
        total: count.total,
        categories: categories.results.map((c) => ({
          id: c.id,
          parentId: c.parent_id,
          name: JSON.parse(c.data).nameZh || JSON.parse(c.data).titleZh || '',
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
