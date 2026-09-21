import { headers } from "next/headers";
import { identity } from "./identity";
import { publicTrade } from "./product-options.mjs";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedAdmin } from "./domain.mjs";
import { permission } from "./cms-domain.mjs";
export const ORIGIN =
  process.env.PUBLIC_ORIGIN ||
  "https://geo-studio-hub.hopezhongyuan.chatgpt.site";
export const defaults = {
  theme: "tech",
  nameZh: "GEO Studio",
  nameEn: "GEO Studio",
  descriptionZh: "把专业经验变成有价值的内容，让每一次探索都有清晰的答案。",
  descriptionEn:
    "Thoughtful ideas, useful products and clear answers. Discover what comes next.",
  heroZh: "好内容，\n让世界发现你。",
  heroEn: "Good ideas.\nReady to be discovered.",
  contactEmail: "",
};
export function database() {
  if (!env.DB) throw new Error("存储服务尚未配置");
  return env.DB;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const ADMIN_PERMISSION: Record<string, string> = {
  readContent: "content.view",
  saveContent: "content.manage",
  deleteContent: "content.manage",
  saveCategory: "content.manage",
  deleteCategory: "content.manage",
  readAssets: "assets.view",
  upload: "assets.manage",
  saveFolder: "assets.manage",
  deleteFolder: "assets.manage",
  moveAsset: "assets.manage",
  renameAsset: "assets.manage",
  deleteAsset: "assets.manage",
  readSubmissions: "forms.view",
  updateSubmission: "forms.manage",
  markSubmission: "forms.manage",
  exportSubmissions: "forms.export",
  saveSettings: "configuration.manage",
  manageConfiguration: "configuration.manage",
  readAnalytics: "analytics.view",
  checkGeo: "analytics.view",
  readPoints: "points.view",
  managePoints: "points.manage",
  readVideo: "videos.view",
  manageVideo: "videos.manage",
  readUsers: "visitors.view",
  manageUsers: "visitors.manage",
};
export function requiredAdminPermission(action: string) {
  return ADMIN_PERMISSION[action] || "";
}
export async function admin(action?: string) {
  const token =
    (await headers())
      .get("cookie")
      ?.match(/(?:^|;\s*)geo_staff=([\w-]{43})(?:;|$)/)?.[1] || "";
  const { user } = await identity("staff-session", { session: token });
  if (!user) throw new HttpError(401, "请登录管理员账号");
  if (user.mustChange) throw new HttpError(403, "请先修改初始密码");
  const required = action ? requiredAdminPermission(action) : "";
  if (
    action &&
    user.role !== "owner" &&
    (required
      ? !(user.permissions || []).includes(required)
      : !permission(user.role, action))
  )
    throw new HttpError(403, "此账号没有该操作权限");
  return {
    userId: "staff:" + user.id,
    email: user.email,
    displayName: user.username,
    fullName: user.username,
    role: user.role,
    permissions: user.permissions || [],
  };
}
export function csrf(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new HttpError(403, "请求来源不匹配");
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "需要 JSON 请求");
  const raw = await boundedResponse(request, 240000).text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "请求格式无效");
  }
}
export function boundedResponse(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "提交内容过大");
  let total = 0;
  const stream = request.body?.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > maxBytes) throw new HttpError(413, "提交内容过大");
        controller.enqueue(chunk);
      },
    }),
  );
  return new Response(stream, { headers: request.headers });
}
export function fail(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  if (status === 500)
    console.error(
      "Request failed",
      error instanceof Error ? error.message : "unknown",
    );
  return Response.json(
    {
      error:
        status === 500
          ? "保存或读取失败，请稍后重试"
          : (error as Error).message,
    },
    { status },
  );
}
export async function limited(key: string, max = 60) {
  const now = Math.floor(Date.now() / 60000);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const hash = Array.from(new Uint8Array(bytes))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const row = await database()
    .prepare(
      "INSERT INTO rates(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rates.expires < ? THEN 1 ELSE rates.count+1 END, expires=? RETURNING count",
    )
    .bind(hash, now, now, now)
    .first<{ count: number }>();
  if (!row || row.count > max)
    throw new HttpError(429, "操作过于频繁，请稍后重试");
}
export async function siteSettings() {
  const row = await database()
    .prepare("SELECT data FROM settings WHERE id=?")
    .bind("site")
    .first<{ data: string }>();
  return row ? { ...defaults, ...JSON.parse(row.data) } : defaults;
}
export async function published(kind?: string) {
  const q = kind
    ? database()
        .prepare(
          'SELECT contents.*, assets.mime AS image_mime FROM contents LEFT JOIN assets ON assets.id=json_extract(contents.data,"$.imageId") WHERE COALESCE(json_extract(contents.data,"$.channels.website"),1)=1 AND status=? AND kind=? ORDER BY contents.updated_at DESC',
        )
        .bind("published", kind)
    : database()
        .prepare(
          'SELECT contents.*, assets.mime AS image_mime FROM contents LEFT JOIN assets ON assets.id=json_extract(contents.data,"$.imageId") WHERE COALESCE(json_extract(contents.data,"$.channels.website"),1)=1 AND status=? ORDER BY contents.updated_at DESC',
        )
        .bind("published");
  const { results } = await q.all<any>();
  return results.map((r) => ({
    ...JSON.parse(r.data),
    ...(r.kind === "products"
      ? { trade: publicTrade(JSON.parse(r.data).trade) }
      : {}),
    id: r.id,
    imageMime: r.image_mime,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
export async function contentBySlug(kind: string, slug: string) {
  const row = await database()
    .prepare(
      'SELECT contents.*, assets.mime AS image_mime FROM contents LEFT JOIN assets ON assets.id=json_extract(contents.data,"$.imageId") WHERE COALESCE(json_extract(contents.data,"$.channels.website"),1)=1 AND status=? AND kind=? AND slug=?',
    )
    .bind("published", kind, slug)
    .first<any>();
  return row
    ? {
        ...JSON.parse(row.data),
        ...(row.kind === "products"
          ? { trade: publicTrade(JSON.parse(row.data).trade) }
          : {}),
        id: row.id,
        imageMime: row.image_mime,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
