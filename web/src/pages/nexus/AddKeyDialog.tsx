import { useState } from 'preact/hooks';
import { POST, ApiError } from '../../api';
import { Modal, Field, Input, FieldRow, Button, FormError, FormNote } from '../../ui';

// Add a credential to a pool. Mirrors POST /admin/providers/:providerId/keys (keys.routes.ts). The
// key joins the shared pool; per-team ownership (BYOK) is assigned from the Teams section, so it is
// intentionally not offered here. After it's added, the pool's Test button probes it upstream.
export function AddKeyDialog({
  providerId, providerName, onClose, onChanged,
}: { providerId: string; providerName: string; onClose: () => void; onChanged: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel]   = useState('');
  const [rpm, setRpm]       = useState('60');
  const [tpm, setTpm]       = useState('100000');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const canSubmit = apiKey.trim().length > 0 && !busy;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await POST(`/admin/providers/${providerId}/keys`, {
        apiKey: apiKey.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
        rpmLimit: Math.max(1, parseInt(rpm, 10) || 60),
        tpmLimit: Math.max(1, parseInt(tpm, 10) || 100000),
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Add key · ${providerName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>{busy ? 'Adding…' : 'Add key'}</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <FormError>{error}</FormError>}
        <FormNote>The key is encrypted before storage and only ever shown masked. It joins this pool's shared rotation.</FormNote>

        <Field label="API key">
          <Input type="password" value={apiKey} placeholder="sk-…" onInput={(e) => setApiKey((e.target as HTMLInputElement).value)} autofocus />
        </Field>
        <Field label="Label" hint="optional">
          <Input value={label} placeholder="primary" onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
        </Field>
        <FieldRow>
          <Field label="RPM limit" hint="per minute">
            <Input type="number" min={1} value={rpm} onInput={(e) => setRpm((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="TPM limit" hint="tokens/min">
            <Input type="number" min={1} value={tpm} onInput={(e) => setTpm((e.target as HTMLInputElement).value)} />
          </Field>
        </FieldRow>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
