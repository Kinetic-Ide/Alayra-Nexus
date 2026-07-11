import { LogOut } from 'lucide-preact';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsBell } from './NotificationsBell';
import s from './shell.module.css';

/**
 * The top bar: live status, theme toggle, notifications, and the account chip. The account name
 * and the sign-out control are placeholders here; P7.7 wires branding (company logo/name) into
 * the account slot and P7.9 the real identity.
 */
export function Topbar() {
  return (
    <header class={s.topbar}>
      <span class={s.livePill}><span class={s.pulse} />LIVE</span>
      <div class={s.topSpacer} />
      <ThemeToggle />
      <NotificationsBell count={0} />
      <div class={s.account}>
        <span class={s.avatar}>A</span>
        <span class={s.accountName}>Admin</span>
        <button type="button" class={s.iconChip} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
      </div>
    </header>
  );
}
