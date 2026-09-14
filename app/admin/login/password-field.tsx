'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export default function PasswordField({
  name,
  label,
  minLength,
  autoComplete,
}: any) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="staff-password-wrap">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          maxLength={128}
          autoComplete={autoComplete}
        />
        <button
          className="staff-password-eye"
          type="button"
          aria-label={visible ? '隐藏' + label : '显示' + label}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}
