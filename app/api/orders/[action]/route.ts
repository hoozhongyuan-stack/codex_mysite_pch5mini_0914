import { selectedIds, orderExportFilter, runBatch, pointBatchPermission, pendingPointRefund } from '@/lib/admin-batch.mjs';
import { cancelRedemption } from '@/lib/redemption';
import { env } from 'cloudflare:workers';
import {
  database,
  csrf,
  jsonBody,
  fail,
  HttpError,
  limited,
} from '@/lib/server';
import {
  buyer,
  orderAdmin,
  commerceConfig,
  createOrder,
  actOrder,
  orderDetail,
  expireOrders,
} from '@/lib/orders';
import { orderConfig, address, text, integer } from '@/lib/order-domain.mjs';
const noCache = { 'Cache-Control': 'private, no-store' };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params,
      q = Object.fromEntries(new URL(request.url).searchParams);
    const db = database();
    if (action === 'availability') {
      const c = await commerceConfig();
      return Response.json({ enabled: c.paymentChannels?.offline === true, offline: c.paymentChannels?.offline === true, wechat: false, requestedWechat: c.paymentChannels?.wechat === true }, { headers: noCache });
    }
    let user: any = null;
    if (action.startsWith('admin-'))
      await orderAdmin(action === 'admin-settings' ? 'settings' : 'view');
    else user = await buyer(request);
    await expireOrders();
    if (action === 'admin-settings')
      return Response.json({...await commerceConfig(),affectedPending:(await db.prepare("SELECT count(*) n FROM orders WHERE status='pending_payment'").first<any>()).n}, { headers: noCache });
    if (action === 'settings') {
      const c = await commerceConfig();
      return Response.json(
        {
          enabled: c.paymentChannels?.offline === true,
          paymentChannels: { offline: c.paymentChannels?.offline === true, wechat: false, requestedWechat: c.paymentChannels?.wechat === true },
          shipping: c.shipping,
          timeoutHours: c.timeoutHours,
          afterSaleDays: c.afterSaleDays,
        },
        { headers: noCache },
      );
    }
    if (action === 'detail' || action === 'admin-detail')
      return Response.json(
        await orderDetail(
          text(q.id, 36, true),
          user ? String(user.id) : undefined,
        ),
        { headers: noCache },
      );
    if (action === 'addresses')
      return Response.json(
        {
          rows: (
            await db
              .prepare(
                "SELECT * FROM order_addresses WHERE user_id=? ORDER BY COALESCE(json_extract(data,'$.isDefault'),0) DESC,updated_at DESC",
              )
              .bind(String(user.id))
              .all<any>()
          ).results.map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
        },
        { headers: noCache },
      );
    if (action === 'cart') {
      const rows = (
        await db
          .prepare(
            'SELECT i.*,c.data,c.status FROM cart_items i JOIN contents c ON c.id=i.product_id WHERE user_id=? ORDER BY i.updated_at DESC',
          )
          .bind(String(user.id))
          .all<any>()
      ).results;
      return Response.json(
        {
          rows: rows.map((r) => {
            const p = JSON.parse(r.data);
            return {
              id: r.id,
              productId: r.product_id,
              variant: r.variant,
              quantity: r.quantity,
              titleZh: p.titleZh,
              titleEn: p.titleEn,
              status: p.channels?.website===false?'unpublished':r.status,
              currency: p.trade?.currency,
              variantData: p.trade?.variants.find(
                (v: any) => v.key === r.variant,
              ),
              imageId: p.imageId || p.imageIds?.[0],
              spu: p.spu,
              specs: (p.trade?.specs || []).map((s:any)=>({...s,values:s.values.filter((v:any)=>r.variant.split('~').includes(v.id))})),
            };
          }),
        },
        { headers: noCache },
      );
    }
    if (!['list', 'admin-list', 'admin-stats'].includes(action))
      throw new HttpError(404, '未知操作');
    const clauses = ['status<>?'],
      args: any[] = ['building'];
    if (user) {
      clauses.push('user_id=?');
      args.push(String(user.id));
    } else if(q.sandbox!=='all') {
      clauses.push('sandbox=?');
      args.push(q.sandbox === '1' ? 1 : 0);
    }
    if(q.orderType==='points'){clauses.push('currency=?');args.push('PTS');}
    if(q.orderType==='cash'){clauses.push('currency<>?');args.push('PTS');}
    if (q.pointsOnly === '1') { clauses.push('currency=?'); args.push('PTS'); }
    if (q.status) {
      clauses.push('status=?');
      args.push(q.status);
    }
    if (q.q) {
      clauses.push(
        '(order_number LIKE ? OR id LIKE ? OR data LIKE ? OR id IN (SELECT order_id FROM order_items WHERE snapshot LIKE ?))',
      );
      args.push(...Array(4).fill('%' + text(q.q, 100) + '%'));
    }
    if(q.channel && q.channel!=='all'){
      if(!['website','mini','unknown'].includes(q.channel)) throw Error('渠道无效');
      clauses.push("(CASE WHEN json_extract(data,'$.sourceEnd')='mini' THEN 'mini' WHEN json_extract(data,'$.sourceEnd') IN ('web','pc','h5','website') THEN 'website' ELSE 'unknown' END)=?");args.push(q.channel);
    }
    const dateColumn=q.dateBasis==='paid'?"(SELECT MIN(h.created_at) FROM order_history h WHERE h.order_id=orders.id AND h.action='approve')":'created_at';
    if (q.from) {
      clauses.push(dateColumn+'>=?');
      args.push(new Date(q.from).toISOString());
    }
    if (q.to) {
      clauses.push(dateColumn+'<?');
      args.push(new Date(q.to).toISOString());
    }
    const where = clauses.join(' AND ');
    if (action === 'admin-stats')
      return Response.json(
        {
          rows: (
            await db
              .prepare(
                `SELECT currency,count(*) count,sum(CASE WHEN status='pending_review' THEN 1 ELSE 0 END) pendingReview,sum(CASE WHEN status='pending_ship' THEN 1 ELSE 0 END) pendingShip,sum(CASE WHEN paid=1 THEN total ELSE 0 END) received,sum(COALESCE(json_extract(data,'$.refundedAmount'),CASE WHEN refunded=1 THEN total ELSE 0 END)) refunded FROM orders WHERE ${where} GROUP BY currency`,
              )
              .bind(...args)
              .all()
          ).results,
        },
        { headers: noCache },
      );
    const size = integer(Number(q.pageSize || 20), 1, 100);
    if (![20, 50, 100].includes(size)) throw Error('分页大小无效');
    const total = (
        await db
          .prepare('SELECT count(*) n FROM orders WHERE ' + where)
          .bind(...args)
          .first<any>()
      ).n,
      pages = Math.max(1, Math.ceil(total / size)),
      page = Math.min(integer(Number(q.page || 1), 1, 100000), pages);
    const rows = (
      await db
        .prepare(
          'SELECT id,order_number,status,currency,total,created_at,data FROM orders WHERE ' +
            where +
            ' ORDER BY created_at DESC,id LIMIT ? OFFSET ?',
        )
        .bind(...args, size, (page - 1) * size)
        .all<any>()
    ).results.map((r) => ({
      ...r,
      data: undefined,
      name: JSON.parse(r.data).address.name,
      email: user ? undefined : JSON.parse(r.data).email,
    }));
    return Response.json({ rows, total, page, pages }, { headers: noCache });
  } catch (e) {
    return fail(
      e instanceof HttpError
        ? e
        : new HttpError(400, e instanceof Error && !/D1_|SQLITE|constraint|FOREIGN KEY|NOT NULL/i.test(e.message) ? e.message : '数据已变化或操作冲突，请刷新后重试'),
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const requestedAction=(await params).action;
    if(requestedAction==='expire'){
      const key=(env as unknown as Record<string,string>).IDENTITY_KEY;
      const supplied=request.headers.get('Authorization')||'';
      if(!key)throw new HttpError(503,'任务服务未配置');
      const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
      const [a,b]=await Promise.all([hash(supplied),hash('Bearer '+key)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
      if(diff)throw new HttpError(403,'Forbidden');
      await expireOrders();
      const { recoverPointOrders } = await import('@/lib/points-recovery');
      return Response.json({ok:true,...await recoverPointOrders()},{headers:noCache});
    }
    csrf(request);
    const { action } = await params,
      input = await jsonBody(request),
      db = database(),
      at = new Date().toISOString();
    if (action.startsWith('admin-')) {
      const op = action.slice(6),
        permission =
          op === 'batch'
            ? pointBatchPermission(input.operation)
            : op === 'settings'
            ? 'settings'
            : op === 'export'
              ? 'export'
              : ['approve', 'reject'].includes(op)
                ? 'finance'
                : ['ship', 'logistics'].includes(op)
                  ? 'fulfill'
                  : ['refund', 'restock', 'reject_aftersale'].includes(op)
                    ? 'aftersale'
                    : 'manage';
      const user = await orderAdmin(permission);
      await limited('order-admin:' + user.userId, 100);
      if (op === 'settings') {
        const checked = orderConfig(input);
        const previous=await commerceConfig();
        const grants = previous.grants || {}; // 权限只通过统一入口修改，忽略旧表单快照。
        if (
          typeof grants !== 'object' ||
          Array.isArray(grants) ||
          Object.keys(grants).length > 100
        )
          throw Error('权限配置无效');
        for (const [email, perms] of Object.entries(grants))
          if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !Array.isArray(perms) ||
            perms.some(
              (p) =>
                ![
                  'view',
                  'settings',
                  'manage',
                  'finance',
                  'fulfill',
                  'aftersale',
                  'export',
                ].includes(p),
            )
          )
            throw Error('权限配置无效');
        const testProductIds = Array.isArray(input.testProductIds)
          ? input.testProductIds.map((v: any) => text(v, 80, true)).slice(0, 50)
          : [];
        for (const m of checked.methods)
          if (
            m.imageId &&
            !(await db
              .prepare(
                "SELECT id FROM assets WHERE id=? AND mime LIKE 'image/%'",
              )
              .bind(m.imageId)
              .first())
          )
            throw Error('收款图片不存在');
        await db.batch([
          db
            .prepare(
              "INSERT INTO settings VALUES('commerce',?) ON CONFLICT(id) DO UPDATE SET data=json_set(excluded.data,'$.grants',json(COALESCE(json_extract(settings.data,'$.grants'),'{}')))",
            )
            .bind(JSON.stringify({ ...checked, grants, testProductIds })),
          db
            .prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?)')
            .bind(
              crypto.randomUUID(),
              user.email,
              'order-settings',
              'commerce',
              at,
            ),
        ]);
        return Response.json({ ok: true }, { headers: noCache });
      }
      if (op === 'batch') {
        if (!['ship','close'].includes(input.operation)) throw Error('批量操作无效');
        const ids=selectedIds(input.selected);
        const reason=text(input.reason || '',500,input.operation==='close');
        const results=await runBatch(ids,async (id:string)=>{
          const current=await orderDetail(id);
          if(current.currency!=='PTS') throw Error('此批量操作仅适用于兑换订单');
          const recovering = input.operation==='close' && pendingPointRefund(current);
          if(current.status!=='pending_ship' && !recovering) throw Error('仅待发货兑换订单或积分退回中的已关闭订单可操作');
          if(input.operation==='close') {
            try { await cancelRedemption(id,current.user_id,user.email,reason); } catch (error) {
              const latest = await orderDetail(id);
              if (pendingPointRefund(latest)) throw Error('订单已关闭，积分退回处理中；可重试或在异常处理恢复');
              throw error;
            }
          } else {
            const shipment=input.shipments?.[id];
            if(!shipment)throw Error('请逐单填写物流信息');
            const company=text(shipment.company,100,true), number=text(shipment.number,100,true);
            await actOrder(id,'ship',user.email,user.orderRole,{company,number});
          }
        });
        return Response.json({results},{headers:noCache});
      }
      if (op === 'export') {
        const filter = orderExportFilter(input);
        const rows = (
          await db
            .prepare(
              'SELECT * FROM orders WHERE '+filter.sql+' ORDER BY created_at DESC LIMIT 10001',
            )
            .bind(...filter.args)
            .all<any>()
        ).results;
        if (rows.length > 10000) throw Error('订单超过10000条，暂不可一次导出');
        await db
          .prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?)')
          .bind(crypto.randomUUID(), user.email, 'order-export', 'orders', at)
          .run();
        return Response.json(
          {
            rows: rows.map((r) => ({
              id: r.id,
              order_number: r.order_number,
              status: r.status,
              currency: r.currency,
              total: r.total,
              created_at: r.created_at,
              name: JSON.parse(r.data).address.name,
              email: JSON.parse(r.data).email,
            })),
          },
          { headers: noCache },
        );
      }
      if (
        ![
          'approve',
          'reject',
          'ship',
          'logistics',
          'refund',
          'restock',
          'reject_aftersale',
          'close',
          'note',
        ].includes(op)
      )
        throw Error('未知操作');
      return Response.json(
        await actOrder(input.id, op, user.email, user.orderRole, input),
        { headers: noCache },
      );
    }
    const user = await buyer(request);
    await limited('orders:' + user.id, 100);
    await expireOrders();
    if (action === 'create')
      return Response.json(await createOrder(user, input), {
        headers: noCache,
      });
    if (action === 'address-save') {
      const checked = address(input),
        id = input.id || crypto.randomUUID();
      if (
        input.id &&
        !(await db
          .prepare('SELECT id FROM order_addresses WHERE id=? AND user_id=?')
          .bind(id, String(user.id))
          .first())
      )
        throw Error('地址不存在');
      const writes = [db.prepare('INSERT INTO order_addresses SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM order_addresses WHERE user_id=?)<20 OR EXISTS(SELECT 1 FROM order_addresses WHERE id=? AND user_id=?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE user_id=excluded.user_id')
        .bind(id,String(user.id),JSON.stringify(checked),at,String(user.id),id,String(user.id))];
      if(checked.isDefault) writes.push(db.prepare("UPDATE order_addresses SET data=json_set(data,'$.isDefault',json('false')) WHERE user_id=? AND id<>? AND EXISTS(SELECT 1 FROM order_addresses WHERE id=? AND user_id=?)").bind(String(user.id),id,id,String(user.id)));
      const saved=await db.batch(writes);
      if(!saved[0].meta.changes) throw new HttpError(400,'最多保存20个地址');
      return Response.json({ id }, { headers: noCache });
    }
    if (action === 'address-delete') {
      await db
        .prepare('DELETE FROM order_addresses WHERE id=? AND user_id=?')
        .bind(input.id, String(user.id))
        .run();
      return Response.json({ ok: true }, { headers: noCache });
    }
    if (action === 'cart-remove') {
      await db
        .prepare('DELETE FROM cart_items WHERE id=? AND user_id=?')
        .bind(input.id, String(user.id))
        .run();
      return Response.json({ ok: true }, { headers: noCache });
    }
    if (action === 'cart-add' || action === 'cart-set') {
      const quantity = integer(input.quantity, 1, 999),
        pid = text(input.productId, 80, true),
        variant = text(input.variant, 200, true),
        p = await db
          .prepare(
            "SELECT data FROM contents WHERE id=? AND kind='products' AND status='published' AND COALESCE(json_extract(data,'$.channels.website'),1)=1",
          )
          .bind(pid)
          .first<any>();
      if (
        !p ||
        !JSON.parse(p.data).trade?.variants.some(
          (v: any) => v.key === variant && v.enabled && v.priceMinor !== null,
        )
      )
        throw Error('商品规格已失效或面议');
      const expression =
        action === 'cart-add'
          ? 'cart_items.quantity+excluded.quantity'
          : 'excluded.quantity';
      await db
        .prepare(
          `INSERT INTO cart_items VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,product_id,variant) DO UPDATE SET quantity=${expression},updated_at=excluded.updated_at WHERE ${expression}<=999`,
        )
        .bind(crypto.randomUUID(), String(user.id), pid, variant, quantity, at)
        .run();
      return Response.json({ ok: true }, { headers: noCache });
    }
    if (
      !['proof', 'cancel', 'receive', 'aftersale', 'withdraw'].includes(action)
    )
      throw Error('未知操作');
    return Response.json(
      await actOrder(
        input.id,
        action,
        String(user.id),
        'user',
        input,
        String(user.id),
      ),
      { headers: noCache },
    );
  } catch (e) {
    return fail(
      e instanceof HttpError
        ? e
        : new HttpError(400, e instanceof Error && !/D1_|SQLITE|constraint|FOREIGN KEY|NOT NULL/i.test(e.message) ? e.message : '数据已变化或操作冲突，请刷新后重试'),
    );
  }
}
