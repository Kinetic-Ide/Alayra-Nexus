import { Card, Badge, EmptyState } from '../../ui';
import type { NexusPool } from '../../api';
import { KeyRow } from './KeyRow';
import s from '../pages.module.css';

// One provider pool: its identity (name, upstream provider, preferred model) and the keys that
// serve it. Purely presentational beyond delegating each key's actions to KeyRow.
export function PoolCard({ pool, onChanged }: { pool: NexusPool; onChanged: () => void }) {
  return (
    <Card>
      <div class={s.poolHead}>
        <div>
          <div class={s.poolName}>{pool.name}</div>
          <div class={s.poolSub}>
            <Badge tone="gray">{pool.provider}</Badge>
            {pool.preferredModel && <span class={s.poolModel}>{pool.preferredModel}</span>}
          </div>
        </div>
        <span class={s.poolCount}>{pool.keys.length} key{pool.keys.length === 1 ? '' : 's'}</span>
      </div>
      {pool.keys.length === 0
        ? <EmptyState>No keys in this pool yet</EmptyState>
        : <div class={s.keyList}>{pool.keys.map((k) => <KeyRow key={k.id} k={k} onChanged={onChanged} />)}</div>}
    </Card>
  );
}
