'use client';
import { Field, Choice } from './shared';
import { Checkbox } from '@/components/ui/checkbox';
export default function FormBuilder({ fields, onChange }: any) {
  const set = (i: number, k: string, v: any) =>
    onChange(
      fields.map((f: any, n: number) => (n === i ? { ...f, [k]: v } : f)),
    );
  const move = (i: number, d: number) => {
    const next = [...fields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <section>
      <div className="section-head" style={{ padding: '16px 0' }}>
        <h2>自定义表单项目</h2>
        <button
          type="button"
          className="btn"
          disabled={fields.length >= 30}
          onClick={() =>
            onChange([
              ...fields,
              {
                id: 'field_' + crypto.randomUUID().slice(0, 8),
                type: 'text',
                labelZh: '新项目',
                labelEn: 'New field',
                required: false,
              },
            ])
          }
        >
          ＋ 添加项目
        </button>
      </div>
      <p className="muted">
        项目改名不会改变标识；已有提交会保留当时的字段名称。
      </p>
      {fields.map((f: any, i: number) => (
        <div className="builder-field" key={f.id}>
          <div className="flex-actions">
            <b>项目 {i + 1}</b>
            <small className="muted">{f.id}</small>
            <button
              className="btn"
              type="button"
              disabled={!i}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              className="btn"
              type="button"
              disabled={i === fields.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                onChange(fields.filter((_: any, n: number) => n !== i))
              }
            >
              移除
            </button>
          </div>
          <div className="field-grid">
            <Field
              label="中文名称"
              required
              value={f.labelZh}
              onChange={(v: string) => set(i, 'labelZh', v)}
            />
            <Field
              label="英文名称"
              required
              value={f.labelEn}
              onChange={(v: string) => set(i, 'labelEn', v)}
            />
          </div>
          <div className="field-grid">
            <Choice
              label="类型"
              value={f.type}
              onChange={(v: string) => set(i, 'type', v)}
              items={[
                ['text', '单行文本'],
                ['textarea', '多行文本'],
                ['phone', '手机号'],
                ['email', '邮箱'],
                ['image', '图片上传'],
                ['time', '时间'],
                ['date', '日期'],
                ['number', '数字'],
              ]}
            />
            <label className="consent" style={{ alignSelf: 'center' }}>
              <Checkbox
                checked={f.required}
                onCheckedChange={(v) => set(i, 'required', v === true)}
              />{' '}
              必填项目
            </label>
          </div>
          <div className="field-grid">
            <Field
              label="中文提示"
              value={f.placeholderZh}
              onChange={(v: string) => set(i, 'placeholderZh', v)}
            />
            <Field
              label="英文提示"
              value={f.placeholderEn}
              onChange={(v: string) => set(i, 'placeholderEn', v)}
            />
          </div>
          {f.type === 'number' && (
            <div className="field-grid">
              <Field
                label="最小值（可选）"
                type="number"
                value={f.min}
                onChange={(v: string) => set(i, 'min', v)}
              />
              <Field
                label="最大值（可选）"
                type="number"
                value={f.max}
                onChange={(v: string) => set(i, 'max', v)}
              />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
