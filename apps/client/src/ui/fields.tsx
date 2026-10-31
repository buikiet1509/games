import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { EyeIcon, EyeOffIcon } from './icons';

interface FieldProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'label'> {
  id: string;
  label: string;
  error?: string;
  /** Nội dung đặt cạnh nhãn (vd. link "Quên mật khẩu?"). */
  aside?: JSX.Element;
}

export function TextField({ id, label, error, aside, ...input }: FieldProps) {
  return (
    <div class="field">
      <div class="field-label-row">
        <label for={id}>{label}</label>
        {aside}
      </div>
      <input
        id={id}
        class="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ id, label, error, aside, ...input }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div class="field">
      <div class="field-label-row">
        <label for={id}>{label}</label>
        {aside}
      </div>
      <div class="input-with-action">
        <input
          id={id}
          class="input"
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...input}
        />
        <button
          type="button"
          class="input-action"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p class="form-alert" role="alert">
      {message}
    </p>
  );
}
