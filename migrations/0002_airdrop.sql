create table if not exists airdrop_fills (
  id serial primary key,
  user_id text not null,
  tx_hash text not null,
  chain text not null,
  kind text not null,
  symbol text not null,
  amount text not null,
  address text not null,
  usd numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, tx_hash)
);

create index if not exists airdrop_fills_user_idx on airdrop_fills (user_id);

create table if not exists airdrop_wallets (
  user_id text not null,
  address text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, address)
);

create table if not exists airdrop_claims (
  id serial primary key,
  user_id text not null,
  units integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists airdrop_claims_user_idx on airdrop_claims (user_id);
