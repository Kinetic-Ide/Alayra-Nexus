import { useState } from 'preact/hooks';
import { POST, ApiError } from '../../api';
import { Modal, Field, Input, Select, FieldRow, Button, FormError } from '../../ui';

// Create a provider pool. Mirrors POST /admin/providers (providers.routes.ts): the upstream provider
// kind is a fixed set, and anything OpenAI-compatible that isn't listed goes through "custom" with an
// explicit base URL. Keys (with their live test probe) are added to the pool afterwards.
const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'openrouter', 'custom'] as const;
const TIERS     = ['premium', 'standard', 'fast'] as const;

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function AddProviderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]         = useState('');
  const [slug, setSlug]         = useState('');
  const [slugEdited, setSlugEd] = useState(false);
  const [provider, setProvider] = useState<string>('openai');
  const [tier, setTier]         = useState<string>('standard');
  const [preferredModel, setPM] = useState('');
  const [baseUrl, setBaseUrl]   = useState('');
  const [authHeader, setAuthH]  = useState('Authorization');
  const [authPrefix, setAuthP]  = useState('Bearer');
  const [modelIdPath, setMIP]   = useState('data[].id');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);
  const isCustom = provider === 'custom';
  const canSubmit = name.trim().length > 0 && effectiveSlug.length > 0 && !busy;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await POST('/admin/providers', {
        name: name.trim(),
        slug: effectiveSlug,
        provider,
        tier,
        ...(preferredModel.trim() ? { preferredModel: preferredModel.trim() } : {}),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        ...(authHeader.trim() ? { authHeader: authHeader.trim() } : {}),
        ...(authPrefix.trim() ? { authPrefix: authPrefix.trim() } : {}),
        ...(modelIdPath.trim() ? { modelIdPath: modelIdPath.trim() } : {}),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the provider.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add provider pool"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>{busy ? 'Creating…' : 'Create pool'}</Button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <FormError>{error}</FormError>}

        <FieldRow>
          <Field label="Display name">
            <Input value={name} placeholder="OpenAI Prod" onInput={(e) => setName((e.target as HTMLInputElement).value)} autofocus />
          </Field>
          <Field label="Slug" hint="url-safe id">
            <Input
              value={effectiveSlug}
              placeholder="openai-prod"
              onInput={(e) => { setSlugEd(true); setSlug(slugify((e.target as HTMLInputElement).value)); }}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Upstream provider">
            <Select value={provider} onChange={(e) => setProvider((e.target as HTMLSelectElement).value)}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Routing tier">
            <Select value={tier} onChange={(e) => setTier((e.target as HTMLSelectElement).value)}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </FieldRow>

        <Field label="Preferred model" hint="optional">
          <Input value={preferredModel} placeholder="gpt-4o" onInput={(e) => setPM((e.target as HTMLInputElement).value)} />
        </Field>

        <Field label="Base URL" hint={isCustom ? 'required for custom' : 'optional override'}>
          <Input value={baseUrl} placeholder="https://api.openai.com/v1" onInput={(e) => setBaseUrl((e.target as HTMLInputElement).value)} />
        </Field>

        {isCustom && (
          <>
            <FieldRow>
              <Field label="Auth header">
                <Input value={authHeader} onInput={(e) => setAuthH((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Auth prefix" hint="optional">
                <Input value={authPrefix} placeholder="Bearer" onInput={(e) => setAuthP((e.target as HTMLInputElement).value)} />
              </Field>
            </FieldRow>
            <Field label="Model-id path" hint="where the model list lives">
              <Input value={modelIdPath} placeholder="data[].id" onInput={(e) => setMIP((e.target as HTMLInputElement).value)} />
            </Field>
          </>
        )}

        {/* Enter-to-submit without showing a duplicate button. */}
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
