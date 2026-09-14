import { formatMoney } from '@/lib/product-options.mjs';
import {
  admin,
  csrf,
  database,
  fail,
  HttpError,
  jsonBody,
  limited,
} from '@/lib/server';
import { csv, submissionEmail } from '@/lib/list-domain.mjs';
export async function GET(request: Request) {
  try {
    await admin('readSubmissions');
    const db = database(),
      id = new URL(request.url).searchParams.get('id');
    const r = await db
      .prepare(
        "SELECT r.*,COALESCE(w.status,'pending') AS processingStatus FROM submissions r LEFT JOIN submission_workflows w ON r.id=w.id WHERE r.id=?",
      )
      .bind(id)
      .first<any>();
    if (!r) throw new HttpError(404, '提交不存在');
    const history = await db
      .prepare(
        'SELECT * FROM submission_history WHERE submission_id=? ORDER BY created_at DESC,id DESC',
      )
      .bind(id)
      .all();
    return Response.json(
      {
        ...JSON.parse(r.data),
        ...r,
        data: undefined,
        history: history.results,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await admin('exportSubmissions');
    await limited('export:' + user.userId, 20);
    const { ids } = await jsonBody(request);
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== 'string' || id.length > 80) ||
      new Set(ids).size !== ids.length
    )
      throw new HttpError(400, '请选择本页 1–100 条记录');
    const db = database();
    const { results } = await db
      .prepare(
        `SELECT r.*,COALESCE(w.status,'pending') AS processingStatus FROM submissions r LEFT JOIN submission_workflows w ON r.id=w.id WHERE r.id IN (${ids.map(() => '?').join(',')}) ORDER BY r.created_at DESC,r.id DESC`,
      )
      .bind(...ids)
      .all<any>();
    if (results.length !== ids.length)
      throw new HttpError(409, '部分记录不存在，请刷新');
    const rows = results.map((r) => {
      const d = JSON.parse(r.data);
      return [
        r.id,
        r.form_id,
        r.created_at,
        r.processingStatus,
        d.name || '',
        submissionEmail(d),
        d.fields
          ? d.fields
              .map(
                (f: any) =>
                  `${f.labelZh}: ${f.type === 'image' ? '[图片请在后台查看]' : String(d.values?.[f.id] ?? '')}`,
              )
              .join('\n')
          : d.message || '',
        d.source?.titleZh || '',
        d.source?.product
          ? d.source.product.specs
              .map((s: any) => s.nameZh + ': ' + s.valueZh)
              .join(' / ')
          : '',
        d.source?.product
          ? formatMoney(
              d.source.product.priceMinor,
              d.source.product.currency,
            ) +
            ' ' +
            d.source.product.currency
          : '',
      ];
    });
    await db
      .prepare(
        'INSERT INTO audit_logs(id,actor,action,target,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        user.email,
        'exportSubmissions',
        `${ids.length} 条记录`,
        new Date().toISOString(),
      )
      .run();
    return new Response(
      csv([
        [
          '提交编号',
          '表单编号',
          '提交时间(UTC)',
          '处理状态',
          '姓名',
          '邮箱',
          '提交内容',
          '来源内容',
          '商品规格',
          '咨询时价格',
        ],
        ...rows,
      ]),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="submissions.csv"',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
