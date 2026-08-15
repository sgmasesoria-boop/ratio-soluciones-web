-- Límites atómicos para el formulario público. Solo se conservan huellas HMAC,
-- nunca direcciones IP ni correos electrónicos en claro.

create table if not exists private.public_intake_rate_limits (
  scope text not null,
  fingerprint text not null,
  window_started timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (scope, fingerprint, window_started)
);

create index if not exists public_intake_rate_limits_expires_at_idx
  on private.public_intake_rate_limits (expires_at);

revoke all on private.public_intake_rate_limits from public, anon, authenticated;

create or replace function public.server_consume_public_intake_limit(
  p_scope text,
  p_fingerprint text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_attempts integer;
begin
  if p_scope not in ('email', 'ip')
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_window_seconds not between 60 and 86400
     or p_max_attempts not between 1 and 100 then
    raise exception 'INVALID_RATE_LIMIT_PARAMETERS';
  end if;

  v_window_started := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  delete from private.public_intake_rate_limits
   where expires_at < v_now;

  insert into private.public_intake_rate_limits (
    scope, fingerprint, window_started, attempts, expires_at
  ) values (
    p_scope,
    p_fingerprint,
    v_window_started,
    1,
    v_window_started + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (scope, fingerprint, window_started)
  do update set attempts = private.public_intake_rate_limits.attempts + 1
  returning attempts into v_attempts;

  return query select
    v_attempts <= p_max_attempts,
    greatest(1, ceil(extract(epoch from (
      v_window_started + make_interval(secs => p_window_seconds) - v_now
    )))::integer);
end;
$$;

revoke all on function public.server_consume_public_intake_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.server_consume_public_intake_limit(text, text, integer, integer)
  to service_role;

