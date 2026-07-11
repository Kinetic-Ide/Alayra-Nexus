-- Phase 6.5: role-based access control. An admin credential now carries a role —
-- "owner" (full control) or "viewer" (read-only: GET routes only, every mutation is
-- refused). This column is the persisted half; dashboard sessions carry their role in
-- Redis, and the raw admin password is always owner.
--
-- Additive and safe: the column defaults to 'owner', so every existing API token keeps
-- exactly the access it had before, with no behaviour change on upgrade.
ALTER TABLE "AdminApiToken"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'owner';
