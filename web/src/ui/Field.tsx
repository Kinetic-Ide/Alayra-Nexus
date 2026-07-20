import type { ComponentChildren, JSX } from 'preact';
import { clsx } from 'clsx';
import s from './ui.module.css';

/** A labelled form control. Wrapping in a <label> means the caption focuses the control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <label class={s.field}>
      <span class={s.fieldLabel}>{label}{hint && <span class={s.fieldHint}>{hint}</span>}</span>
      {children}
    </label>
  );
}

/**
 * A captioned block for content that is NOT a single form control — a read-only value, or a row of
 * buttons. Uses a <div>, not a <label>: a label with no control to point at is invalid markup, and
 * worse, any <button> inside it inherits the caption as its accessible name (so a "Replace" button
 * would announce itself as the whole caption text).
 */
export function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class={s.field}>
      <span class={s.fieldLabel}>{label}{hint && <span class={s.fieldHint}>{hint}</span>}</span>
      {children}
    </div>
  );
}

export function Input({ class: cls, ...props }: JSX.IntrinsicElements['input']) {
  return <input class={clsx(s.input, cls)} {...props} />;
}

export function Select({ class: cls, children, ...props }: JSX.IntrinsicElements['select']) {
  return <select class={clsx(s.input, cls)} {...props}>{children}</select>;
}

/** A two-column row of fields (e.g. RPM / TPM side by side). */
export function FieldRow({ children }: { children: ComponentChildren }) {
  return <div class={s.formRow}>{children}</div>;
}

/** A dismissable inline error banner for a form. */
export function FormError({ children }: { children: ComponentChildren }) {
  return <div class={s.formError} role="alert">{children}</div>;
}

/** A quiet explanatory note inside a form. */
export function FormNote({ children }: { children: ComponentChildren }) {
  return <p class={s.formNote}>{children}</p>;
}
