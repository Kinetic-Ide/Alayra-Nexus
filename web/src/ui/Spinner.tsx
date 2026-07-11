import s from './ui.module.css';

export function Spinner() {
  return <span class={s.spinner} role="status" aria-label="Loading" />;
}
