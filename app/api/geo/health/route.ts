import {
  admin,
  csrf,
  limited,
  ORIGIN,
  published,
  siteSettings,
  fail,
} from "@/lib/server";
import { inspectPublicPage } from "@/lib/geo-health.mjs";
async function probe(path: string) {
  // Only server-owned origin and internally selected paths; never forward cookies or credentials.
  const response = await fetch(new URL(path, new URL(ORIGIN).origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "Aition-GEO-Health/1.0" },
    cache: "no-store",
  });
  const reader = response.body?.getReader();
  let text = "",
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 3000000) throw Error("页面超过检查大小上限");
        text += decoder.decode(value, { stream: true });
      }
  } finally {
    await reader?.cancel();
  }
  return {
    status: response.status,
    robots: response.headers.get("x-robots-tag") || "",
    html: text,
  };
}
export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await admin("checkGeo");
    await limited("geo-health:" + user.userId, 12);
    const [items, settings] = await Promise.all([published(), siteSettings()]);
    const examples = ["articles", "products"].flatMap((kind) => {
      const r = items.find((r: any) => r.kind === kind);
      return r ? [`/zh/${kind}/${encodeURIComponent(r.slug)}`] : [];
    });
    const paths = [
      ...new Set([
        "/zh",
        "/en",
        "/zh/articles",
        "/zh/products",
        "/zh/videos",
        "/zh/events",
        "/zh/points-shop",
        ...examples,
      ]),
    ];
    const pages: any[] = [];
    // Bound concurrency and outbound request count; this is a sample, not a full crawler.
    for (let start = 0; start < paths.length; start += 3) {
      pages.push(
        ...(await Promise.all(
          paths.slice(start, start + 3).map(async (path) => {
            try {
              return inspectPublicPage({ path, ...(await probe(path)) });
            } catch {
              return {
                path,
                status: 0,
                issues: ["检查失败，请稍后重试"],
                schemaTypes: [],
              };
            }
          }),
        )),
      );
    }
    const extras = await Promise.all(
      ["/robots.txt", "/sitemap.xml"].map(async (path) => {
        try {
          return { path, ...(await probe(path)) };
        } catch {
          return { path, status: 0, html: "" };
        }
      }),
    );
    const robots = extras[0],
      sitemap = extras[1];
    const contentIssues = items.flatMap((r: any) => {
      const issues = [];
      if (
        /测试|沙箱|仅测试|test/i.test(
          (r.titleZh || "") + " " + (r.summaryZh || ""),
        )
      )
        issues.push("包含测试措辞，请确认演示标注或正式用途");
      if (!r.summaryZh?.trim() || !r.summaryEn?.trim())
        issues.push("缺少中文或英文摘要");
      if (
        r.kind === "articles" &&
        (!r.author?.trim() || /[0-9]/.test(r.author))
      )
        issues.push("作者信息需人工核对");
      return issues.length
        ? [{ id: r.id, title: r.titleZh, kind: r.kind, issues }]
        : [];
    });
    return Response.json(
      {
        checkedAt: new Date().toISOString(),
        origin: new URL(ORIGIN).origin,
        pages,
        robots: {
          status: robots.status,
          blocksAll: /^\s*Disallow:\s*\/\s*$/m.test(robots.html),
          text: robots.html.slice(0, 3000),
        },
        sitemap: {
          status: sitemap.status,
          urls: (sitemap.html.match(/<loc>/g) || []).length,
        },
        contentIssues,
        brandIssue:
          !settings.descriptionZh ||
          /这是一个新品牌|测试/.test(settings.descriptionZh)
            ? "品牌简介仍较笼统，请说明品牌、产品及服务对象。"
            : "",
        scope: "固定入口与文章/商品各一例；不代表全站检查或搜索引擎已收录。",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
