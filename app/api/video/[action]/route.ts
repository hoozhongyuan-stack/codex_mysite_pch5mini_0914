import { richAssets } from "@/lib/cms-domain.mjs";
import { videoBody } from "@/lib/video-body.mjs";
import { env } from "cloudflare:workers";
import {
  admin,
  csrf,
  jsonBody,
  fail,
  HttpError,
  database,
  boundedResponse,
} from "@/lib/server";
import { identity, visitorSession } from "@/lib/identity";
function staff(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)geo_staff=([\w-]{43})(?:;|$)/)?.[1] || ""
  );
}
function context(request: Request) {
  return {
    session: visitorSession(request),
    browser:
      request.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)geo_play=([\w-]{43})(?:;|$)/)?.[1] || "",
  };
}
async function internal(
  action: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) {
  const e = env as unknown as Record<string, string>;
  if (!e.IDENTITY_URL || !e.IDENTITY_KEY)
    throw new HttpError(503, "视频服务未配置");
  return fetch(e.IDENTITY_URL + "/" + action, {
    method: "POST",
    headers: { Authorization: "Bearer " + e.IDENTITY_KEY, ...headers },
    body,
    signal: AbortSignal.timeout(120000),
  });
}
export async function GET(request: Request, { params }: any) {
  try {
    const { action } = await params;
    const data = Object.fromEntries(new URL(request.url).searchParams);
    if (action === "admin-source-preview") {
      await admin("manageVideo");
      const r = await internal(
        "video-source-preview",
        JSON.stringify({ id: data.id }),
        {
          "Content-Type": "application/json",
          "X-Staff-Session": staff(request),
          ...(request.headers.get("range")
            ? { Range: request.headers.get("range")! }
            : {}),
        },
      );
      const headers = new Headers({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      for (const name of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
      ]) {
        const value = r.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(r.body, { status: r.status, headers });
    }
    if (action === "stream") {
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(data.token || "") ||
        !context(request).browser
      )
        throw new HttpError(403, "播放授权无效");
      const r = await internal(
        "video-file",
        JSON.stringify({ ...data, ...context(request) }),
        { "Content-Type": "application/json" },
      );
      return new Response(r.body, {
        status: r.status,
        headers: {
          "Content-Type":
            r.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (
      ![
        "list",
        "detail",
        "mine",
        "admin-list",
        "admin-detail",
        "admin-library",
      ].includes(action)
    )
      throw new HttpError(404, "未知操作");
    if (action.startsWith("admin-")) {
      await admin(
        ["admin-list", "admin-detail", "admin-library"].includes(action)
          ? "readVideo"
          : "manageVideo",
      );
      const folders =
        action === "admin-library"
          ? await database().prepare("SELECT id FROM asset_folders").all()
          : null;
      return Response.json(
        await identity("admin-video-" + action.slice(6), {
          ...data,
          ...(folders
            ? { _folders: folders.results.map((f: any) => f.id) }
            : {}),
          _staff: staff(request),
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      await identity("video-" + action, { ...data, ...context(request) }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request, { params }: any) {
  try {
    csrf(request);
    const { action } = await params;
    if (action === "source-chunk") {
      await admin("manageVideo");
      const q = new URL(request.url).searchParams;
      const bytes = await boundedResponse(
        request,
        8 * 1024 * 1024,
      ).arrayBuffer();
      const r = await internal(
        "video-source-chunk?" +
          new URLSearchParams({
            id: q.get("id") || "",
            offset: q.get("offset") || "",
          }),
        bytes,
        {
          "X-Staff-Session": staff(request),
          "Content-Type": "application/octet-stream",
        },
      );
      return new Response(r.body, {
        status: r.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }
    const data = await jsonBody(request);
    if (action === "admin-source-import") {
      await admin("manageVideo");
      const asset: any = await database()
        .prepare("SELECT * FROM assets WHERE id=? AND mime LIKE ?")
        .bind(data.id, "video/%")
        .first();
      if (!asset) throw new HttpError(404, "素材不存在");
      const object = await env.FILES.get(data.id);
      if (!object || object.size > 1024 ** 3)
        throw new HttpError(400, "素材无效或超过1 GB");
      const source = await identity("admin-video-source-init", {
        _staff: staff(request),
        name: asset.name || "video.mp4",
        size: object.size,
        folder: data.folder || "",
      });
      try {
        const reader = object.body.getReader();
        let offset = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (
            let start = 0;
            start < value.byteLength;
            start += 8 * 1024 * 1024
          ) {
            const part = value.slice(start, start + 8 * 1024 * 1024);
            const r = await internal(
              "video-source-chunk?" +
                new URLSearchParams({ id: source.id, offset: String(offset) }),
              part,
              {
                "X-Staff-Session": staff(request),
                "Content-Type": "application/octet-stream",
              },
            );
            if (!r.ok) throw new HttpError(503, "视频素材导入失败");
            offset += part.length;
          }
        }
        return Response.json(
          await identity("admin-video-source-complete", {
            id: source.id,
            _staff: staff(request),
          }),
        );
      } catch (e) {
        await identity("admin-video-source-cancel", {
          id: source.id,
          _staff: staff(request),
        }).catch(() => {});
        throw e;
      }
    }
    if (
      [
        "admin-save-series",
        "admin-save-episode",
        "admin-retry",
        "admin-source-init",
        "admin-source-complete",
        "admin-source-update",
        "admin-source-delete",
        "admin-source-cancel",
      ].includes(action)
    ) {
      await admin("manageVideo");
      if (["admin-save-series", "admin-save-episode"].includes(action)) {
        for (const key of ["bodyZh", "bodyEn"]) {
          try {
            data[key] = videoBody(data[key]);
          } catch (e) {
            throw new HttpError(400, (e as Error).message);
          }
        }
        data.id = data.id || crypto.randomUUID();
        for (const assetId of new Set([
          ...richAssets(data.bodyZh),
          ...richAssets(data.bodyEn),
        ])) {
          if (
            !(await database()
              .prepare("SELECT id FROM assets WHERE id=?")
              .bind(assetId)
              .first())
          )
            throw new HttpError(400, "详情素材不存在");
          await database()
            .prepare(
              "INSERT OR IGNORE INTO marketing_assets(id,event_id,asset_id) VALUES(?,?,?)",
            )
            .bind(
              "video:" + data.id + ":" + assetId,
              "video:" + data.id,
              assetId,
            )
            .run();
        }
      }
      if (
        ["admin-save-series", "admin-save-episode"].includes(action) &&
        data.imageId
      ) {
        if (
          !(await database()
            .prepare("SELECT id FROM assets WHERE id=? AND mime LIKE ?")
            .bind(data.imageId, "image/%")
            .first())
        )
          throw new HttpError(400, "封面必须是图片");
        data.id = data.id || crypto.randomUUID();
        data.create = data.create ?? false;
        await database()
          .prepare(
            "INSERT OR IGNORE INTO marketing_assets(id,event_id,asset_id) VALUES(?,?,?)",
          )
          .bind(
            "video:" + data.id + ":" + data.imageId,
            "video:" + data.id,
            data.imageId,
          )
          .run();
      }
      return Response.json(
        await identity("admin-video-" + action.slice(6), {
          ...data,
          _staff: staff(request),
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!["authorize", "progress", "renew", "release"].includes(action))
      throw new HttpError(404, "未知操作");
    const ctx = context(request);
    if (!ctx.browser) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      ctx.browser = btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
    }
    const result = await identity("video-" + action, { ...data, ...ctx });
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `geo_play=${ctx.browser}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
