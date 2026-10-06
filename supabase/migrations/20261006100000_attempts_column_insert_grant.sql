-- Security audit 2: `authenticated` could insert every column, including
-- created_at. Back-dated rows never count toward the rate-limit trigger's
-- "last minute" window, so the limit could be bypassed (and users could rewrite
-- their own history's timing). Users may now supply only the answer itself;
-- id, user_id (auth.uid()) and created_at (now()) always come from defaults.
revoke insert on public.attempts from authenticated;
grant insert (topic, item_id, answer, correct) on public.attempts to authenticated;
