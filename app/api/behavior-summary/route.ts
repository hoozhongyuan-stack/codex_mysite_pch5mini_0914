import { admin, database, limited, HttpError, fail } from '@/lib/server';
import { period, within, series } from '@/lib/dashboard-domain.mjs';
import { summarizeBehavior } from '@/lib/behavior-domain.mjs';
export async function GET(request: Request) {
  try {
    const user = await admin();
    if (user.role !== 'owner')
      throw new HttpError(403, '仅主管理员可查看行为统计');
    await limited('behavior-summary:' + user.userId, 30);
    const q = Object.fromEntries(new URL(request.url).searchParams);
    let p;
    try {
      p = period(q);
    } catch {
      throw new HttpError(400, '请选择有效的1至90天日期');
    }
    const channel = q.channel || 'all';
    if (!['all', 'website', 'mini'].includes(channel))
      throw new HttpError(400, '渠道无效');
    if (q.dataMode && q.dataMode !== 'all')
      return Response.json(
        {
          available: false,
          reason: '匿名行为无法可靠区分演示与正式用户，请选择全部数据',
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    const db = database();
    await db
      .prepare('DELETE FROM behavior_events WHERE created_at<?')
      .bind(new Date(Date.now() - 90 * 86400000).toISOString())
      .run();
    const meta = await db
      .prepare('SELECT started_at FROM behavior_metadata WHERE id=?')
      .bind('collection')
      .first<any>();
    if (!meta)
      return Response.json(
        {
          available: false,
          reason: '尚无已同意采集的行为记录，历史访问无法补算',
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    const rows = (
      await db
        .prepare(
          "SELECT channel,visitor_hash,session_hash,event,path,target,created_at FROM behavior_events WHERE created_at>=? AND created_at<? AND (?='all' OR channel=?) ORDER BY created_at LIMIT 20001",
        )
        .bind(p.previousStart, p.endAt, channel, channel)
        .all<any>()
    ).results;
    if (rows.length > 20000)
      throw new HttpError(422, '所选期间事件较多，请缩短日期范围');
    const current = rows.filter((r) =>
        within(r.created_at, p.startAt, p.endAt),
      ),
      previous = rows.filter((r) =>
        within(r.created_at, p.previousStart, p.startAt),
      );
    const coverageStart = new Date(
      Math.max(Date.parse(meta.started_at), Date.now() - 90 * 86400000),
    ).toISOString();
    const result = summarizeBehavior(current);
    const articles = await Promise.all(
      result.articles.map(async (item: any) => {
        const content = await db
          .prepare(
            "SELECT slug,json_extract(data,'$.titleZh') title FROM contents WHERE kind='articles' AND (id=? OR slug=?) LIMIT 1",
          )
          .bind(item.target, item.target)
          .first<any>();
        return {
          ...item,
          title: content?.title || '内容已删除或不可用',
          href: content
            ? '/zh/articles/' + encodeURIComponent(content.slug)
            : null,
        };
      }),
    );

    return Response.json(
      {
        available: true,
        ...result,
        articles,
        previous: summarizeBehavior(previous),
        period: p,
        channel,
        coverageStart,
        partial: coverageStart > p.startAt,
        previousPartial: coverageStart > p.previousStart,
        daily: series(
          current.filter((r) => r.event === 'page_view'),
          p,
        ),
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
