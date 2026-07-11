import { useState } from 'preact/hooks';
import { Card, Tabs, CodeBlock, type TabItem } from '../../ui';

// Copy-paste quick-starts, filled with this gateway's own base URL and key so a developer can be
// making calls in seconds. Same three ways the gateway is meant to be used: raw HTTP, the OpenAI
// SDK (point its base URL here), and the Anthropic SDK.
const TABS: TabItem[] = [
  { id: 'curl',      label: 'cURL' },
  { id: 'openai',    label: 'OpenAI SDK' },
  { id: 'anthropic', label: 'Anthropic SDK' },
];

export function QuickStart({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [tab, setTab] = useState('curl');
  const key = apiKey || 'YOUR_NEXUS_KEY';

  const snippets: Record<string, { lang: string; code: string }> = {
    curl: {
      lang: 'bash',
      code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`,
    },
    openai: {
      lang: 'python',
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${key}",
)

resp = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)
print(resp.choices[0].message.content)`,
    },
    anthropic: {
      lang: 'python',
      code: `from anthropic import Anthropic

client = Anthropic(
    base_url="${baseUrl}",
    api_key="${key}",
)

msg = client.messages.create(
    model="auto",
    max_tokens=512,
    messages=[{"role": "user", "content": "Hello"}],
)
print(msg.content[0].text)`,
    },
  };

  const active = snippets[tab];

  return (
    <Card heading="Quick start">
      <Tabs items={TABS} active={tab} onChange={setTab} />
      <div style={{ marginTop: '12px' }}>
        <CodeBlock code={active.code} lang={active.lang} />
      </div>
    </Card>
  );
}
