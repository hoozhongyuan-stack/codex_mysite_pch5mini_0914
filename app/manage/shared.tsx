'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  type = 'text',
  maxLength = 30000,
  placeholder,
}: any) {
  return (
    <label className="field">
      <span>
        {required && (
          <b className="required-mark" aria-hidden="true">
            *
          </b>
        )}
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          maxLength={maxLength}
          required={required}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          required={required}
        />
      )}
    </label>
  );
}
export function Choice({
  value,
  onChange,
  items,
  label,
  required = false,
}: any) {
  return (
    <label className="field">
      <span>
        {required && (
          <b className="required-mark" aria-hidden="true">
            *
          </b>
        )}
        {label}
      </span>
      <Select required={required} value={value} onValueChange={onChange}>
        <SelectTrigger style={{ width: '100%', height: 42 }}>
          <SelectValue>
            {items.find((i: any) => i[0] === value)?.[1] || '请选择'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map(([v, l]: any) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export async function mutate(action: string, data: any) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const result: any = await r.json();
  if (!r.ok) throw new Error(result.error || '操作失败');
  return result;
}
