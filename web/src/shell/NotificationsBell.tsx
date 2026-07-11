import { Bell } from 'lucide-preact';
import s from './shell.module.css';

/**
 * Live notifications bell. P7.7 wires this to a real feed endpoint (unread count, click-through
 * to the originating section). For now it renders the control and its count contract so the shell
 * is complete and the count badge is already styled.
 */
export function NotificationsBell({ count = 0 }: { count?: number }) {
  return (
    <button type="button" class={s.iconChip} aria-label={`Notifications (${count} unread)`} title="Notifications">
      <Bell size={17} />
      {count > 0 && <span class={s.bellCount}>{count > 99 ? '99+' : count}</span>}
    </button>
  );
}
