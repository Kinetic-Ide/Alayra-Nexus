import { useState } from 'preact/hooks';
import { clsx } from 'clsx';
import { Copy, Check } from 'lucide-preact';
import s from './ui.module.css';

/** A multi-line, monospace code sample with a one-click copy. Used for quick-start snippets. */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div class={s.code}>
      {lang && <span class={s.codeLang}>{lang}</span>}
      <button type="button" class={clsx(s.codeCopy, copied && s.copied)} onClick={copy} aria-label="Copy code">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <pre><code>{code}</code></pre>
    </div>
  );
}
