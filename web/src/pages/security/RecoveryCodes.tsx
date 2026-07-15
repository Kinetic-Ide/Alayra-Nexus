import { useState } from 'preact/hooks';
import { Button } from '../../ui';
import s from '../pages.module.css';

// The one-time reveal of recovery codes, shown after enrolling or regenerating. They are stored only
// as hashes on the server, so this is the single moment they exist in the clear — the copy is loud
// about that, because there is no second chance to see them.
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    catch { /* clipboard blocked */ }
  };

  return (
    <div class={s.recovery}>
      <p class={s.recoveryWarn}>
        <b>Save these recovery codes now.</b> Each one works once, to sign in if you lose your
        authenticator. They are never shown again — the gateway keeps only a hash.
      </p>
      <div class={s.recoveryGrid}>
        {codes.map((c) => <code key={c} class={s.recoveryCode}>{c}</code>)}
      </div>
      <div class={s.recoveryActions}>
        <Button size="sm" variant="secondary" onClick={copyAll}>{copied ? 'Copied' : 'Copy all'}</Button>
        <Button size="sm" variant="primary" onClick={onDone}>I’ve saved them</Button>
      </div>
    </div>
  );
}
