import {channelPredicate} from '@/lib/mini-business.mjs';
import { identity, visitorSession } from '@/lib/identity';
import {
  csrf,
  database,
  fail,
  HttpError,
  jsonBody,
  limited,
} from '@/lib/server';
import { inquirySnapshot } from '@/lib/product-options.mjs';
import { validateValues, legacyFields } from '@/lib/cms-domain.mjs';
export async function POST(request: Request) {return submitForm(request)}
export async function submitForm(request:Request, mini?:{user:any}) {
  try {
    if(!mini)csrf(request);
    const channel=mini?"mini":"website";
    await limited(
      'form:' + (request.headers.get('cf-connecting-ip') || 'anonymous'),
      5,
    );
    const input = await jsonBody(request);
    if (input.website || input.consent !== true)
      throw new HttpError(400, '请同意隐私说明后提交');
    const db = database(),
      form = await db
        .prepare(
          `SELECT data,updated_at FROM contents WHERE id=? AND kind='forms' AND status='published' AND ${channelPredicate(channel)}`,
        )
        .bind(String(input.formId || ''))
        .first<any>();
    if (!form) throw new HttpError(404, '表单未开放');
    const config = JSON.parse(form.data),
      fields = config.fields || legacyFields;
    if (config.fields && input.formVersion !== form.updated_at)
      throw new HttpError(409, '表单已更新，请刷新页面后填写');
    let values;
    try {
      values = validateValues(fields, input.values || input);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const session = mini ? "mini:"+mini.user.id :
      request.headers
        .get('cookie')
        ?.match(/(?:^|;\s*)form_upload_session=([a-f0-9-]{36})(?:;|$)/)?.[1] ||
      '';
    const imageIds: string[] = [];
    for (const f of fields) {
      if (f.type === 'image' && values[f.id]) {
        const file = await db
          .prepare(
            'SELECT id FROM submission_files WHERE id=? AND form_id=? AND field_id=? AND session=? AND submission_id IS NULL',
          )
          .bind(values[f.id], input.formId, f.id, session)
          .first();
        if (!file)
          throw new HttpError(400, '图片已过期或不属于当前表单，请重新上传');
        imageIds.push(String(values[f.id]));
      }
    }
    const policy = await db
      .prepare(
        "SELECT version FROM policies WHERE kind='privacy' AND published IS NOT NULL",
      )
      .first<any>();
    if ((policy?.version || null) !== (input.privacyVersion || null))
      throw new HttpError(409, '隐私协议已更新，请刷新页面后重新确认');
    let source: any = null;
    let sourceVersion: string | null = null;
    if (input.sourceContentId) {
      const row = await db
        .prepare(
          `SELECT id,kind,slug,data,updated_at FROM contents WHERE id=? AND kind IN ('articles','products') AND status='published' AND ${channelPredicate(channel)} AND json_extract(data,'$.linkedFormId')=?`,
        )
        .bind(String(input.sourceContentId), input.formId)
        .first<any>();
      if (!row) throw new HttpError(409, '关联内容已更新，请刷新后重试');
      sourceVersion = row.updated_at;
      source = {
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        titleZh: JSON.parse(row.data).titleZh,
        titleEn: JSON.parse(row.data).titleEn,
        ...(row.kind === 'products'
          ? {
              product: (() => {
                try {
                  return inquirySnapshot(
                    { ...JSON.parse(row.data), updatedAt: row.updated_at },
                    input.productSelection,
                  );
                } catch (e) {
                  throw new HttpError(409, (e as Error).message);
                }
              })(),
            }
          : {}),
      };
    }
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const visitor = mini?.user || (visitorSession(request) ? (await identity('session', {session: visitorSession(request)})).user : null);
    const data = {
      ...(visitor ? {_points: {userId: visitor.id, status: 'pending', at: now}} : {}),
      values,
      fields,
      source,
      origin: {end: mini ? "mini" : ["pc","h5"].includes(input.sourceEnd) ? input.sourceEnd : "web", page: typeof input.sourcePage === "string" && /^\/(?!\/)[a-zA-Z0-9/_-]{0,200}$/.test(input.sourcePage) ? input.sourcePage : ""},
      schemaVersion: form.updated_at,
      language: input.language === 'en' ? 'en' : 'zh',
      name: values.name || '表单访客',
      email: values.email || '',
      consent: { acceptedAt: now, privacyVersion: policy?.version || null },
    };
    const mediaGuard = imageIds.length
      ? ` AND (SELECT COUNT(*) FROM submission_files WHERE id IN (${imageIds.map(() => '?').join(',')}) AND session=? AND submission_id IS NULL)=?`
      : '';
    const guard =
      mediaGuard +
      (source
        ? ` AND EXISTS(SELECT 1 FROM contents WHERE id=? AND status='published' AND ${channelPredicate(channel)} AND updated_at=? AND json_extract(data,'$.linkedFormId')=?)`
        : '');
    const statement = db
      .prepare(
        `INSERT INTO submissions(id,form_id,data,status,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM contents WHERE id=? AND status='published' AND updated_at=? AND ${channelPredicate(channel)})${guard}`,
      )
      .bind(
        id,
        input.formId,
        JSON.stringify(data),
        'new',
        now,
        input.formId,form.updated_at,
        ...(imageIds.length ? [...imageIds, session, imageIds.length] : []),
        ...(source ? [source.id, sourceVersion, input.formId] : []),
      );
    const result = await db.batch([
      statement,
      ...imageIds.map((file) =>
        db
          .prepare(
            'UPDATE submission_files SET submission_id=? WHERE id=? AND session=? AND submission_id IS NULL AND EXISTS(SELECT 1 FROM submissions WHERE id=?)',
          )
          .bind(id, file, session, id),
      ),
    ]);
    if (!result[0].meta.changes)
      throw new HttpError(409, '商品、表单或图片已更新，请刷新页面后重试');
    let pointsPending = false;
    if (visitor) {
      try {
        await identity('points-form', {userId: visitor.id, id, at: now});
        await db.prepare("UPDATE submissions SET data=json_set(data,'$._points.status','done') WHERE id=?").bind(id).run();
      } catch { pointsPending = true; }
    }
    return Response.json({ ok: true, id, pointsPending }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
