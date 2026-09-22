import {
  channelTransition,
  validateMini,
  checkMiniCapabilities,
} from "@/lib/channel-config.mjs";
import {
  siteSettings,
  admin,
  csrf,
  database,
  fail,
  HttpError,
  jsonBody,
  limited,
} from "@/lib/server";
import {
  channelState,
  checkChannelConfig,
  resolvedFloating,
} from "@/lib/channel-store";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("admin") === "1") {
      await admin("manageConfiguration");
      const forms = (
        await database()
          .prepare(
            "SELECT id,status,json_extract(data,'$.channels.mini') AS mini,json_extract(data,'$.channels.website') AS website FROM contents WHERE kind='forms'",
          )
          .all<any>()
      ).results;
      return Response.json(
        { ...(await channelState()), formAvailability: forms },
        {
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    const end = url.searchParams.get("end") || "pc";
    if (!["pc", "h5", "mini"].includes(end))
      throw new HttpError(400, "展示端无效");
    const lang = url.searchParams.get("lang") === "en" ? "en" : "zh",
      state = await channelState();
    const settings = end === "mini" ? await siteSettings() : null;
    return Response.json(
      {
        brand: settings
          ? { name: settings.nameZh, logoId: settings.brand?.logoId || "" }
          : null,
        capabilities:
          end === "mini"
            ? [
                "home",
                "products",
                "articles",
                "points",
                "account",
                "cart",
                "videos",
                "events",
                "microPage",
              ]
            : undefined,
        revision: state.revision,
        mini: end === "mini" ? state.published?.mini : null,
        floating: await resolvedFloating(
          state.published?.floating || [],
          end,
          lang,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await admin("manageConfiguration");
    await limited("channel-config:" + user.userId, 30);
    const input = await jsonBody(request),
      old = await channelState();
    if (input.revision !== old.revision)
      throw new HttpError(409, "配置已更新，请刷新后重试");
    if (!["save", "publish", "rollback"].includes(input.action))
      throw new HttpError(400, "操作无效");
    const section = input.section;
    if (!["mini", "floating"].includes(section))
      throw new HttpError(400, "配置区域无效");
    let checked;
    try {
      checked = await checkChannelConfig(
        {
          ...{ mini: validateMini(), floating: [] },
          [section]:
            input.action === "rollback"
              ? old.previous?.[section]
              : input.data?.[section],
        },
        input.action === "save",
      );
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (input.action === "rollback" && !old.previous)
      throw new HttpError(400, "没有可回退的发布版本");
    if (section === "mini" && input.action !== "save") {
      try {
        checkMiniCapabilities(checked.mini);
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
    }
    const revision = crypto.randomUUID();
    const state = {
      ...channelTransition(
        old,
        section,
        checked[section as "mini" | "floating"],
        input.action,
      ),
      revision,
    };
    const db = database();
    const r = await db
      .prepare(
        "INSERT INTO settings(id,data) VALUES('channels',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(settings.data,'$.revision')=?",
      )
      .bind(JSON.stringify(state), old.revision)
      .run();
    if (!r.meta.changes) throw new HttpError(409, "配置已更新，请刷新后重试");
    await db
      .prepare(
        "INSERT INTO audit_logs(id,actor,action,target,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        user.email,
        "channels:" + input.action,
        "channels",
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true, ...state });
  } catch (e) {
    return fail(e);
  }
}
