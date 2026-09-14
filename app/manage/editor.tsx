'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Field, Choice, mutate } from './shared';
import RichEditor from './rich-editor';
import ProductOptionsEditor from './product-options';
import AssetPicker from './asset-picker';
import FormBuilder from './form-builder';
import { validateContent } from '@/lib/domain.mjs';
import { legacyFields } from '@/lib/cms-domain.mjs';
export default function Editor({
  record,
  assets,
  folders = [],
  categories = [],
  forms = [],
  onClose,
  onSaved,
}: any) {
  const [data, setData] = useState(
    record.kind === 'forms'
      ? { ...record, fields: record.fields || legacyFields }
      : record,
  );
  const images: string[] =
    data.imageIds ?? (data.imageId ? [data.imageId] : []);
  const setImages = (ids: string[]) =>
    setData((d: any) => ({ ...d, imageIds: ids, imageId: ids[0] || '' }));
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: 'nearest' });
      errorRef.current?.focus();
    }
  }, [error]);
  const set = (key: string, value: any) =>
    setData((d: any) => ({ ...d, [key]: value }));
  async function save(status = data.status) {
    const payload = { ...data, status };
    setError('');
    try {
      validateContent(payload);
    } catch (e) {
      setError((e as Error).message + (status === 'published' ? '。补全后可发布，也可以先保存草稿。' : '。请修正后保存草稿。'));
      return;
    }
    if (
      status === 'published' && data.kind === 'products' &&
      data.trade?.variants?.some((v: any) => v.enabled && v.priceMinor === 0) &&
      !window.confirm('当前包含价格为 0 的商品组合，前台会显示 0 元。确认发布？')
    ) return;
    setBusy(true);
    setError('');
    try {
      await mutate('saveContent', { data: payload, expectedUpdatedAt: record.updatedAt });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {data.id ? '编辑' : '创建'}
            {data.kind === 'articles'
              ? '文章'
              : data.kind === 'products'
                ? '商品'
                : '表单'}
          </DialogTitle>
          <DialogDescription>
            中英文分别编辑。发布前请补全两个语言版本。
          </DialogDescription>
        </DialogHeader>
        <form className={'admin-content-editor' + (data.kind === 'forms' ? ' editor-form-layout' : '')} noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className="error">{error}</p>}
          <div className="editor-content-column"><Tabs defaultValue="zh">
            <TabsList>
              <TabsTrigger value="zh">简体中文</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
            {['Zh', 'En'].map((lang) => (
              <TabsContent key={lang} value={lang.toLowerCase()}>
                <Field
                  label={lang === 'Zh' ? '标题' : '英文标题'}
                  value={data['title' + lang]}
                  onChange={(v: string) => set('title' + lang, v)}
                  required={lang === 'Zh' || data.status === 'published'}
                  maxLength={160}
                />
                <Field
                  label="内容摘要"
                  value={data['summary' + lang]}
                  onChange={(v: string) => set('summary' + lang, v)}
                  multiline
                  required={data.status === 'published'}
                  maxLength={500}
                />
                {data.kind !== 'forms' && (
                  <div>
                    <div className="field">
                      <span>
                        {data.status === 'published' && (
                          <b className="required-mark" aria-hidden="true">
                            *
                          </b>
                        )}
                        正文
                      </span>
                    </div>
                    <RichEditor
                      value={data['rich' + lang]}
                      plain={data['body' + lang]}
                      onChange={(v: any) => set('rich' + lang, v)}
                      assets={assets}
                      folders={folders}
                    />
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs></div>
          <div className="editor-settings-column">
          <h3 className="editor-group-title">发布设置</h3>
          <div className="editor-publish-fields">
            <Field
              label="链接名称（小写字母与连字符）"
              value={data.slug}
              onChange={(v: string) => set('slug', v)}
              required
              maxLength={80}
            />
            <Choice
              label="发布状态"
              value={data.status}
              onChange={(v: string) => set('status', v)}
              items={[
                ['draft', '草稿'],
                ['published', '发布到前台'],
              ]}
            />
          </div>
          <div className="field"><span>展示渠道</span><div className="flex-actions editor-channel-choices">{[['website','网站（PC / H5）'],['mini','微信小程序']].map(([key,label])=><label key={key}><input type="checkbox" checked={key==='website'?data.channels?.website!==false:data.channels?.mini===true} onChange={e=>set('channels',{website:data.channels?.website!==false,mini:data.channels?.mini===true,[key]:e.target.checked})}/> {label}</label>)}</div><small className="muted">渠道控制展示范围；只有已发布内容才会展示。小程序默认关闭。</small></div>
          {data.kind !== 'forms' ? (
            <>

              <Choice
                label="关联表单（可选）"
                value={data.linkedFormId || ''}
                onChange={(v: string) => set('linkedFormId', v)}
                items={[
                  ['', '不挂载表单'],
                  ...forms
                    .filter((f: any) => f.status === 'published')
                    .map((f: any) => [f.id, f.titleZh]),
                  ...(data.linkedFormId &&
                  !forms.some(
                    (f: any) =>
                      f.id === data.linkedFormId && f.status === 'published',
                  )
                    ? [[data.linkedFormId, '关联表单已失效，请重新选择']]
                    : []),
                ]}
              />
              <h3 className="editor-group-title">分类与归属</h3>
              <div className="field-grid">
                <Choice
                  label="分类"
                  value={data.categoryId || ''}
                  onChange={(v: string) => set('categoryId', v)}
                  items={[
                    ['', '未分类'],
                    ...categories
                      .filter((c: any) => c.kind === data.kind)
                      .map((c: any) => [
                        c.id,
                        (c.parent_id
                          ? categories.find((p: any) => p.id === c.parent_id)
                              ?.nameZh + ' / '
                          : '') + c.nameZh,
                      ]),
                  ]}
                />
                <Field
                  label="作者 / 品牌"
                  value={data.author}
                  onChange={(v: string) => set('author', v)}
                  maxLength={100}
                />
              </div>
              {data.kind === 'articles' && <div className="field">
                <Field label="发布时间（可补录历史时间）" type="datetime-local"
                  value={data.publishedAt && Number.isFinite(Date.parse(data.publishedAt)) ? new Date(Date.parse(data.publishedAt)-new Date(data.publishedAt).getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}
                  onChange={(v:string)=>set('publishedAt',v ? new Date(v).toISOString() : '')}/>
                <small>首次发布自动记录；历史时间缺失时请填写真实时间，留空不改已有时间。</small>
              </div>}
              <h3 className="editor-group-title">封面与媒体</h3>
              <div className="field">
                {data.kind === 'products' && (
                  <Field
                    label="商品编码 / SPU（可选，不可重复）"
                    value={data.spu}
                    maxLength={80}
                    onChange={(v: string) => set('spu', v)}
                  />
                )}
                <span>
                  {data.kind === 'products'
                    ? '商品主图（最多10张，第一张为封面）'
                    : '封面图片 / 视频'}
                </span>
                {data.kind === 'products' && (
                  <div className="gallery-editor">
                    {images.map((id, i) => (
                      <div key={id}>
                        <img
                          src={'/api/media/' + id}
                          alt={'商品图片 ' + (i + 1)}
                        />
                        <div>
                          <button
                            type="button"
                            className="btn"
                            disabled={i === 0}
                            onClick={() =>
                              setImages([id, ...images.filter((v) => v !== id)])
                            }
                          >
                            {i === 0 ? '封面' : '设为封面'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={i === 0}
                            onClick={() => {
                              const next = [...images];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              setImages(next);
                            }}
                          >
                            前移
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() =>
                              setImages(images.filter((v) => v !== id))
                            }
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPicker(true)}
                  >
                    从素材库选择
                  </button>
                  <span className="muted">
                    {assets.find((a: any) => a.id === data.imageId)?.name ||
                      '尚未选择'}
                  </span>
                  {data.imageId && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        data.kind === 'products'
                          ? setImages([])
                          : set('imageId', '')
                      }
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
              <Field
                label="参考来源（HTTPS，可选）"
                value={data.sourceUrl}
                onChange={(v: string) => set('sourceUrl', v)}
              />
            </>
          ) : (
            <FormBuilder
              fields={data.fields}
              onChange={(v: any) => set('fields', v)}
            />
          )}
          </div>
          <div className="editor-trade-section">              {data.kind === 'products' && (
                <ProductOptionsEditor
                  published={data.status === 'published'}
                  value={data.trade}
                  onChange={(v: any) => set('trade', v)}
                />
              )}</div>
          <div
            className="flex-actions editor-save-actions"
          >
            <button aria-busy={Boolean(busy)}
              className="btn"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button aria-busy={Boolean(busy)} className="btn" type="button" disabled={busy} onClick={() => void save('draft')}>
              保存草稿
            </button>
            <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
              {busy ? '保存中…' : data.status === 'published' ? '保存并发布' : '保存内容'}
            </button>
          </div>
        </form>
        {picker && (
          <AssetPicker
            assets={assets}
            folders={folders}
            accept={data.kind === 'products' ? 'image' : 'all'}
            multiple={data.kind === 'products'}
            initialIds={images}
            max={10}
            onClose={() => setPicker(false)}
            onSelect={(a: any) => {
              if (data.kind === 'products') setImages(a.map((v: any) => v.id));
              else set('imageId', a.id);
              setPicker(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
