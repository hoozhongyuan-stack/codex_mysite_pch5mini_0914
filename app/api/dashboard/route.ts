import { admin, database, fail, HttpError, limited } from "@/lib/server";
import { identity } from "@/lib/identity";
import { commerceConfig } from "@/lib/orders";
import {
  period,
  counts,
  summarizeTrade,
  sourceChannel,
  within,
} from "@/lib/dashboard-domain.mjs";
export async function GET(request: Request) {
  try {
    const user = await admin("readAnalytics");
    await limited("dashboard:" + user.userId, 60);
    const q = Object.fromEntries(new URL(request.url).searchParams),
      p = period(q);
    const channel = q.channel || "all",
      dataMode = q.dataMode || "all";
    if (
      !["all", "website", "mini", "unknown"].includes(channel) ||
      !["all", "formal", "demo"].includes(dataMode)
    )
      throw new HttpError(400, "筛选条件无效");
    const db = database(),
      owner = user.role === "owner";
    const unavailable = (reason: string) => ({ available: false, reason });
    const rows = async (sql: string, args: any[] = []) =>
      (
        await db
          .prepare(sql)
          .bind(...args)
          .all<any>()
      ).results;
    const capture = async (fn: () => Promise<any>) => {
      try {
        return await fn();
      } catch {
        return unavailable("读取失败，请刷新重试");
      }
    };
    const matching = (r: any) =>
      (channel === "all" || sourceChannel(r.source) === channel) &&
      (dataMode === "all" ||
        Boolean(Number(r.sandbox)) === (dataMode === "demo"));
    const token =
      request.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)geo_staff=([\w-]{43})(?:;|$)/)?.[1] || "";
    const [trade, leads, geo, members, stock] = await Promise.all([
      capture(async () => {
        const config = await commerceConfig();
        if (
          !owner &&
          !user.permissions.includes("orders.view") &&
          !config.grants?.[user.email.toLowerCase()]?.includes("view")
        )
          return unavailable("无订单查看权限");
        const orders = (
          await rows(
            "SELECT o.id,o.currency,o.total,o.status,o.sandbox,json_extract(o.data,'$.sourceEnd') source,MIN(h.created_at) first_paid FROM orders o LEFT JOIN order_history h ON h.order_id=o.id AND h.action='approve' WHERE o.status<>'building' GROUP BY o.id,o.currency,o.total,o.status,o.sandbox,o.data",
          )
        ).filter(matching);
        const refunds = (
          await rows(
            "SELECT o.currency,o.sandbox,json_extract(o.data,'$.sourceEnd') source,json_extract(h.data,'$.amount') amount,h.created_at FROM order_history h JOIN orders o ON o.id=h.order_id WHERE h.action='refund' AND h.created_at>=? AND h.created_at<?",
            [p.startAt, p.endAt],
          )
        ).filter(matching);
        const ranked = await rows(
          "SELECT i.product_id,i.snapshot,i.quantity,i.unit_price,o.id order_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.currency<>'PTS' AND EXISTS(SELECT 1 FROM order_history h WHERE h.order_id=o.id AND h.action='approve' AND h.created_at>=? AND h.created_at<?)",
          [p.startAt, p.endAt],
        );
        const selected = new Map(
          orders
            .filter((o: any) => within(o.first_paid, p.startAt, p.endAt))
            .map((o: any) => [o.id, o]),
        );
        const products = new Map<string, any>();
        for (const i of ranked) {
          const o: any = selected.get(i.order_id);
          if (!o) continue;
          const key = i.product_id + ":" + o.currency,
            old = products.get(key) || {
              id: i.product_id,
              title: JSON.parse(i.snapshot).titleZh || "商品",
              currency: o.currency,
              quantity: 0,
              amount: 0,
            };
          products.set(key, {
            ...old,
            quantity: old.quantity + Number(i.quantity),
            amount: old.amount + Number(i.quantity) * Number(i.unit_price),
          });
        }
        return {
          ...summarizeTrade(orders, refunds, p),
          todos: ["pending_review", "pending_ship", "aftersale"].map(
            (status) => ({
              status,
              count: orders.filter(
                (o: any) => o.currency !== "PTS" && o.status === status,
              ).length,
            }),
          ),
          pointPending: orders.filter(
            (o: any) => o.currency === "PTS" && o.status === "pending_ship",
          ).length,
          ranking: [...products.values()]
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5),
        };
      }),
      owner
        ? capture(async () => {
            if (dataMode !== "all")
              return unavailable("表单未记录可靠演示标记，请选择全部数据");
            const records = (
              await rows(
                "SELECT s.created_at,json_extract(s.data,'$.origin.end') source,COALESCE(w.status,'pending') workflow FROM submissions s LEFT JOIN submission_workflows w ON w.id=s.id",
              )
            ).filter(
              (r: any) =>
                channel === "all" || sourceChannel(r.source) === channel,
            );
            return {
              ...counts(records, p),
              pending: records.filter((r: any) => r.workflow === "pending")
                .length,
            };
          })
        : unavailable("无表单记录权限"),
      owner
        ? capture(async () => {
            if (channel !== "all" || dataMode !== "all")
              return unavailable(
                "访问记录尚不支持可靠渠道/演示拆分，请选择全部",
              );
            const records = await rows(
              "SELECT kind,path,created_at FROM visits WHERE created_at>=? AND created_at<?",
              [p.previousStart, p.endAt],
            );
            return {
              ...counts(
                records.filter((r: any) => r.kind === "ai_referral"),
                p,
              ),
              bots: records.filter(
                (r: any) =>
                  r.kind === "claimed_bot" &&
                  within(r.created_at, p.startAt, p.endAt),
              ).length,
              evidence: Number(
                (
                  await db
                    .prepare("SELECT COUNT(*) n FROM evidence")
                    .first<any>()
                ).n,
              ),
            };
          })
        : unavailable("无 GEO 查看权限"),
      capture(() =>
        identity("staff-dashboard", {
          session: token,
          start: p.start,
          end: p.end,
          channel,
          dataMode,
        }),
      ),
      capture(async () => {
        if (dataMode !== "all")
          return unavailable("商品未统一记录演示标记，请选择全部数据");
        const products = await rows(
          "SELECT id,data FROM contents WHERE kind='products' AND status='published'",
        );
        const lows = products.flatMap((r: any) => {
          const d = JSON.parse(r.data),
            t = d.trade || {};
          if (
            channel === "unknown" ||
            (channel === "mini" && !d.channels?.mini) ||
            (channel === "website" && d.channels?.website === false)
          )
            return [];
          const values =
            t.inventoryMode === "variants"
              ? (t.variants || [])
                  .filter((v: any) => v.enabled)
                  .map((v: any) => v.inventory)
              : [t.inventory];
          return values.some((v: any) => Number.isInteger(v) && v <= 5)
            ? [{ id: r.id, title: d.titleZh }]
            : [];
        });
        return {
          available: true,
          count: lows.length,
          rows: lows.slice(0, 5),
          threshold: 5,
        };
      }),
    ]);
    return Response.json(
      {
        updatedAt: new Date().toISOString(),
        period: p,
        channel,
        dataMode,
        trade,
        leads,
        geo,
        members,
        stock,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(
      e instanceof HttpError
        ? e
        : new HttpError(400, e instanceof Error ? e.message : "统计请求失败"),
    );
  }
}
