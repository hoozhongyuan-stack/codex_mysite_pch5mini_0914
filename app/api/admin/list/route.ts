import {period} from '@/lib/dashboard-domain.mjs';
import { admin, database, fail, HttpError } from '@/lib/server';
import { listQuery, modules, submissionEmail } from '@/lib/list-domain.mjs';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      kind = params.get('kind') || '';
    if (
      !['articles', 'products', 'forms', 'submissions', 'logs'].includes(kind)
    )
      throw new HttpError(400, '列表类型无效');
    await admin(
      ['submissions', 'logs'].includes(kind)
        ? 'readSubmissions'
        : 'readContent',
    );
    let q: any;
    try {
      q = listQuery(params);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const db = database(),
      where: string[] = [],
      args: any[] = [];
    const add = (sql: string, ...values: any[]) => {
      where.push(sql);
      args.push(...values);
    };
    let table = '',
      columns = 'r.*',
      date = 'r.created_at';
    if (['articles', 'products', 'forms'].includes(kind)) {
      table = 'contents r';
      if (kind === 'products') columns = "r.*,(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=r.id AND o.currency='PTS' AND o.status<>'closed') AS redemptionUsed,(SELECT json_group_array(json_object('variant',i.variant,'quantity',i.quantity)) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=r.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')) AS stockReservations";
      date = 'r.updated_at';
      add('r.kind=?', kind);
      if(kind==='products' && params.get('mall')==='listed') add("COALESCE(json_extract(r.data,'$.trade.redemptionListed'),json_extract(r.data,'$.trade.redemptionEnabled'),0)=1");
      if (q.q)
        add(
          "(instr(lower(json_extract(r.data,'$.titleZh')),lower(?))>0 OR instr(lower(json_extract(r.data,'$.titleEn')),lower(?))>0 OR instr(lower(r.slug),lower(?))>0 OR instr(lower(COALESCE(json_extract(r.data,'$.spu'),'')),lower(?))>0)",
          q.q,
          q.q,
          q.q,
          q.q,
        );
      if (q.status) add('r.status=?', q.status);
      if(kind==='products'&&params.get('lowStock')==='1'){
       add("r.status='published'");
       add("((COALESCE(json_extract(r.data,'$.trade.inventoryMode'),'shared')<>'variants' AND json_type(r.data,'$.trade.inventory')='integer' AND CAST(json_extract(r.data,'$.trade.inventory') AS INTEGER)<=5) OR (json_extract(r.data,'$.trade.inventoryMode')='variants' AND EXISTS(SELECT 1 FROM json_each(r.data,'$.trade.variants') v WHERE json_extract(v.value,'$.enabled')=1 AND json_type(v.value,'$.inventory')='integer' AND CAST(json_extract(v.value,'$.inventory') AS INTEGER)<=5)))");
       const ch=params.get('dashChannel');if(ch==='mini')add("json_extract(r.data,'$.channels.mini')=1");if(ch==='website')add("COALESCE(json_extract(r.data,'$.channels.website'),1)=1");if(ch==='unknown')add('1=0');
      }
      const channel = params.get('channel');
      if (channel && channel !== 'mini') throw new HttpError(400, '展示渠道无效');
      if (channel === 'mini') add("json_extract(r.data,'$.channels.mini')=1");
      if (q.category)
        add(
          "(json_extract(r.data,'$.categoryId')=? OR json_extract(r.data,'$.categoryId') IN (SELECT id FROM categories WHERE parent_id=? AND kind=?))",
          q.category,
          q.category,
          kind,
        );
    } else if (kind === 'submissions') {
      table =
        'submissions r LEFT JOIN submission_workflows w ON w.id=r.id LEFT JOIN contents c ON c.id=r.form_id';
      columns =
        "r.*,COALESCE(w.status,'pending') AS processingStatus,json_extract(c.data,'$.titleZh') AS formTitle";
      if (q.q)
        add(
          "(instr(lower(COALESCE(json_extract(r.data,'$.name'),'')),lower(?))>0 OR instr(lower(COALESCE(json_extract(r.data,'$.email'),'')),lower(?))>0 OR EXISTS (SELECT 1 FROM json_each(r.data,'$.fields') f, json_each(r.data,'$.values') v WHERE json_extract(f.value,'$.type')='email' AND v.key=json_extract(f.value,'$.id') AND instr(lower(v.value),lower(?))>0))",
          q.q,
          q.q,
          q.q,
        );
      if (q.form) add('r.form_id=?', q.form);
      if (q.status) add("COALESCE(w.status,'pending')=?", q.status);
      const channel=params.get('channel');
      if(channel&&channel!=='all'){if(!['website','mini','unknown'].includes(channel))throw new HttpError(400,'渠道无效');add("(CASE WHEN json_extract(r.data,'$.origin.end')='mini' THEN 'mini' WHEN json_extract(r.data,'$.origin.end') IN ('web','pc','h5','website') THEN 'website' ELSE 'unknown' END)=?",channel);}
      if(params.get('dashboard')==='1'){const p=period({start:params.get('start'),end:params.get('end')});add('r.created_at>=?',p.startAt);add('r.created_at<?',p.endAt);}
    } else {
      table = 'audit_logs r';
      if (q.actor) add('instr(lower(r.actor),lower(?))>0', q.actor);
      if (q.action) add('r.action=?', q.action);
      if (q.module) {
        const actions = (modules as any)[q.module];
        if (!actions) throw new HttpError(400, '模块无效');
        add(`r.action IN (${actions.map(() => '?').join(',')})`, ...actions);
      }
    }
    if (q.from) add(`${date}>=?`, q.from + 'T00:00:00.000Z');
    if (q.to)
      add(`${date}<?`, new Date(Date.parse(q.to) + 86400000).toISOString());
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const count = await db
      .prepare(`SELECT COUNT(*) AS total FROM ${table}${clause}`)
      .bind(...args)
      .first<any>();
    const total = count.total,
      pages = Math.max(1, Math.ceil(total / q.size)),
      page = Math.min(q.page, pages);
    const { results } = await db
      .prepare(
        `SELECT ${columns} FROM ${table}${clause} ORDER BY ${date} ${q.sort === 'asc' ? 'ASC' : 'DESC'},r.id ${q.sort === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`,
      )
      .bind(...args, q.size, (page - 1) * q.size)
      .all<any>();
    const rows = results.map((r) =>
      kind === 'logs'
        ? r
        : {
            ...JSON.parse(r.data),
            ...r,
            data: undefined,
            ...(kind === 'submissions'
              ? { email: submissionEmail(JSON.parse(r.data)) }
              : {}),
            updatedAt: r.updated_at,
          },
    );
    return Response.json(
      { rows, total, page, size: q.size, pages },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
