-- USERS TABLE
create table users (
  wallet_address text primary key,
  nickname text,
  current_rank text default 'Initiate',
  xp integer default 0,
  joined_at timestamp with time zone default timezone('utc', now())
);

-- SWAP HISTORY TABLE
create table swap_history (
  id uuid primary key default gen_random_uuid(),
  user_wallet text references users(wallet_address) on delete cascade,
  from_asset text not null,
  to_asset text not null,
  amount numeric not null,
  chain_from text,
  chain_to text,
  route_used text not null,
  status text default 'success',
  timestamp timestamp with time zone default timezone('utc', now())
);
