import { useState } from 'preact/hooks';
import { Search, RefreshCw, X } from 'lucide-preact';
import {
  PATCH, ApiError, fetchProviderModels,
  type NexusKeyHealth, type FetchedModel,
} from '../../api';
import { addModelsToRegistry, type RegistryModelInput } from '../../lib/registry';
import { Modal, Field, FieldBlock, Input, PasswordInput, FieldRow, Button, FormError, FormNote } from '../../ui';
import { ModelPicker } from './ModelPicker';
import s from '../pages.module.css';

// Edit an existing key: its label, the three limits, and — optionally — the credential itself.
// Mirrors PATCH /admin/keys/:id.
//
// P7.17c: the masked credential used to sit in the modal's TITLE, where a full-length mask ran off
// the edge and had to be scrolled sideways to read. It now lives in the body as a boxed, truncating
// row with a Replace button beside it, and replacing is progressive: the input only appears when
// asked for. Because a new credential often means a different catalogue, a replacement can re-fetch
// this provider's models and merge the chosen ones (with their pricing) on save.
export function EditKeyDialog({ k, providerId, provider, tier, onClose, onSaved }: {
  k: NexusKeyHealth;
  providerId: string;
  provider: string;
  tier: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId                  = `edit-key-form-${k.id}`;
  const [label, setLabel]       = useState(k.label ?? '');
  const [rpm, setRpm]           = useState(String(k.rpmLimit));
  const [tpm, setTpm]           = useState(String(k.tpmLimit));
  const [maxUsers, setMaxUsers] = useState(String(k.maxUsers));
  const [replacing, setReplacing] = useState(false);
  const [apiKey, setApiKey]     = useState('');
  const [fetched, setFetched]   = useState<FetchedModel[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [fetchGen, setFetchGen] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const cancelReplace = () => {
    setReplacing(false);
    setApiKey(''); setFetched([]); setSelected([]);
  };

  const doFetch = async () => {
    if (!apiKey.trim()) { setError('Enter the replacement key first, then fetch its models.'); return; }
    setFetching(true); setError(null);
    try {
      const r = await fetchProviderModels(providerId, apiKey.trim());
      if (r.models.length) {
        setFetched(r.models);
        setSelected([]);
        setFetchGen((g) => g + 1);
      } else {
        setError('No models returned for this key.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not fetch models.');
    } finally {
      setFetching(false);
    }
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    // Fall back to the stored limit only when the field can't be parsed at all. Using `|| k.rpmLimit`
    // would also reject a typed `0` (falsy) and silently keep the old value; clamp it to 1 instead.
    const parsedRpm      = parseInt(rpm, 10);
    const parsedTpm      = parseInt(tpm, 10);
    const parsedMaxUsers = parseInt(maxUsers, 10);
    try {
      await PATCH(`/admin/keys/${k.id}`, {
        label:    label.trim(),
        rpmLimit: Math.max(1, Number.isNaN(parsedRpm) ? k.rpmLimit : parsedRpm),
        tpmLimit: Math.max(1, Number.isNaN(parsedTpm) ? k.tpmLimit : parsedTpm),
        maxUsers: Math.max(1, Number.isNaN(parsedMaxUsers) ? k.maxUsers : parsedMaxUsers),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      if (selected.length) {
        const byId = new Map(fetched.map((m) => [m.id, m]));
        const inputs: RegistryModelInput[] = selected.map((id) => {
          const m = byId.get(id);
          return {
            modelString: id,
            displayName: m?.name,
            inputCostPer1M: m?.inputCostPer1M,
            outputCostPer1M: m?.outputCostPer1M,
            contextWindow: m?.contextWindow,
          };
        });
        await addModelsToRegistry(provider, tier, inputs);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={k.label ? `Edit key · ${k.label}` : 'Edit key'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} disabled={busy}>{busy ? 'Saving…' : 'Save key'}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        {error && <FormError>{error}</FormError>}

        <FieldBlock label="Credential" hint={replacing ? 'replacing' : 'stored, encrypted'}>
          <div class={s.keyCurrentRow}>
            <code class={s.keyCurrent}>{k.maskedKey}</code>
            {!replacing
              ? <Button variant="secondary" onClick={() => setReplacing(true)}><RefreshCw size={13} /> Replace</Button>
              : <Button variant="ghost" onClick={cancelReplace}><X size={13} /> Keep current</Button>}
          </div>
        </FieldBlock>

        {replacing && (
          <Field label="New API key" hint="replaces the stored credential on save">
            <div class={s.keyInputRow}>
              <div class={s.keyInputWrap}>
                <PasswordInput
                  value={apiKey}
                  placeholder="sk-…"
                  autoFocus
                  onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                />
              </div>
              <Button variant="secondary" onClick={doFetch} disabled={fetching || !apiKey.trim()}>
                <Search size={13} /> {fetching ? 'Fetching…' : 'Fetch models'}
              </Button>
            </div>
          </Field>
        )}

        {replacing && fetched.length > 0 && (
          <Field
            label={`Models (${selected.length}/${fetched.length} selected)`}
            hint="click to select — only selected models join the registry"
          >
            <ModelPicker key={fetchGen} models={fetched} selected={selected} onChange={setSelected} />
          </Field>
        )}

        <Field label="Label" hint="optional">
          <Input value={label} placeholder="primary" onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
        </Field>

        <FieldRow>
          <Field label="Max users" hint="distinct users/day">
            <Input type="number" min={1} value={maxUsers} onInput={(e) => setMaxUsers((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="RPM limit" hint="per minute">
            <Input type="number" min={1} value={rpm} onInput={(e) => setRpm((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="TPM limit" hint="tokens/min">
            <Input type="number" min={1} value={tpm} onInput={(e) => setTpm((e.target as HTMLInputElement).value)} />
          </Field>
        </FieldRow>

        <FormNote>
          A replaced key is re-encrypted and re-masked; the old value is discarded. Max users caps how many
          distinct end-users this key serves per day, and applies only to requests that identify their user.
        </FormNote>
      </form>
    </Modal>
  );
}
