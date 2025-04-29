-- USERS TABLE
create table users (
  id uuid primary key,
  wallet_address text unique not null,
  nickname text,
  current_rank text default 'Initiate',
  xp integer default 0,
  joined_at timestamp with time zone default timezone('utc', now())
);

-- SWAP HISTORY TABLE
create table swap_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  from_asset text not null,
  to_asset text not null,
  amount numeric not null,
  chain_from text,
  chain_to text,
  route_used text not null,
  status text default 'success', -- new field
  timestamp timestamp with time zone default timezone('utc', now())
);
