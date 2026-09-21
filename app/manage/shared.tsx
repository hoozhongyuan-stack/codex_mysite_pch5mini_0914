'use client';
import { useId, useRef } from 'react';
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
  width,
  error,
  hint,
  ...inputProps
}: any) {
  const id = useId();
  return (
    <label className="field" data-width={width || (type === 'number' ? 'short' : multiline ? 'full' : 'full')}>
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
          {...inputProps}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? id : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          maxLength={maxLength}
          required={required}
        />
      ) : (
        <input
          {...inputProps}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? id : undefined}
          type={type}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          required={required}
        />
      )}
      {(error || hint) && <small id={id} className={error ? 'field-error' : 'muted'}>{error || hint}</small>}
    </label>
  );
}
export function Choice({
  value,
  onChange,
  items,
  label,
  required = false,
  width = 'standard',
}: any) {
  const field = useRef<HTMLLabelElement>(null);
  return (
    <label ref={field} className="field" data-width={width}>
      <span>
        {required && (
          <b className="required-mark" aria-hidden="true">
            *
          </b>
        )}
        {label}
      </span>
      <Select required={required} value={value} onValueChange={(next) => { if(next !== value) { onChange(next); field.current?.dispatchEvent(new CustomEvent('admin:field-change', {bubbles:true})); } }}>
        <SelectTrigger>
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
