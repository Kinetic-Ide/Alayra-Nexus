import { useState } from 'preact/hooks';
import { clsx } from 'clsx';
import { Copy, Check } from 'lucide-preact';
import { Button } from './Button';
import s from './ui.module.css';

/** A monospace value with a one-click copy — used for base URLs, keys, and IDs. */
export function CopyField({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div class={s.copy}>
      {label && <span class={s.copyLabel}>{label}</span>}
      <span class={s.copyVal}>{value}</span>
      <Button size="sm" variant="ghost" class={clsx(s.copyBtn, copied && s.copied)} onClick={copy} aria-label="Copy">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
