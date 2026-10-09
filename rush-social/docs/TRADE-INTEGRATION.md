# Capture every Market Rush trade

The supplied attachment is a compiled HTML/React bundle, not the database source. It proves these API contracts exist:

- `mr_me()` → `{ player: { name, cash, holdings, ... }, trades: [...] }`
- `mr_leaderboard()` → `{ top: [{ name, rank, worth, you }], me, players }`
- `mr_profile(p_name)` → `{ name, cash, worth, rank, trades, ... }`
- `mr_trade(p_symbol, p_qty)` → `{ player, trade }`

It does **not** reveal the game table names, ownership columns, or function SQL. Do not guess those and run a trigger on production. The frontend reads game stats through the existing RPCs and never accepts cash/rank from profile edits.

## Required server hook

After installing migration `001_rush_social.sql`, the game owner must call `public.rs_record_trade` from the existing **server-side trade transaction**, or from an `AFTER INSERT` trigger on the actual trade ledger. Using a trigger is best when multiple game paths can generate trades.

Add the equivalent of this inside the existing `mr_trade` implementation, **after the trade has succeeded and before the transaction returns**. Replace each `actual_*` placeholder with the variable/column from the real game function:

```sql
perform public.rs_record_trade(
  actual_trade_owner_auth_uuid,
  actual_player_name,
  actual_trade_id::text,
  jsonb_build_object(
    'symbol', actual_symbol,
    'side', actual_side,          -- uppercase BUY or SELL
    'shares', actual_share_count,-- positive shares, including on sells
    'price', actual_execution_price,
    'total', actual_trade_total,
    'pnl', actual_realized_pnl,  -- NULL on buys; game's realized profit on sells
    'pnlPct', actual_pnl_percent -- NULL if the game does not record this
  ),
  actual_execution_timestamp
);
```

The caller must be the function owner (usually a `SECURITY DEFINER` game RPC or trigger). Keep `rs_record_trade` revoked from `anon` and `authenticated`. Do not grant it to clients to make an invoker-only function work; instead use an owner-controlled trigger. Every trade is written in the same transaction as execution, duplicate source IDs are ignored, and trades for users who have never visited Rush Social are still captured. Use a globally unique source ID, with a table prefix if several ledgers are involved.

The helper only creates a social profile and feed post. It does not change money, holdings, rankings, or game behavior. All players' future trades become visible to signed-in players, so communicate this game feature to your community before enabling the hook.

## Historical trades

Run an owner-only backfill over the real game ledger, calling the same helper with each original trade ID and timestamp. The attachment doesn't establish whether the ledger retains all trades. History can only be as complete as the server data. Deduplication makes repeating the same backfill safe. Do not backfill by scanning players' browser sessions.

## Validation on a staging copy

1. Record player A's current cash and rank. Sign in to Rush Social with A's existing email/password. Verify the same trader name and figures.
2. Keep Rush Social closed. Execute a buy and sell in Market Rush as A. Open Rush Social as B; confirm both appear once, with original timestamps, correct share count/price, and realized P/L on sells.
3. Execute a trade as a player who has never signed in to Rush Social; confirm it appears.
4. Retry an ingestion with the same source ID. Confirm it does not create a duplicate.
5. Log in as B and attempt REST inserts with `kind='trade'`, or edits to A's profile. Both must be rejected.
6. Test simultaneous likes, cross-account comments, JPG/PNG/WebP uploads, rejects for SVG/oversized uploads, session refresh, and sign-out.

The live feed polls every 15 seconds while the tab is visible. It is shared and durable, but not a WebSocket stream. Current feed filters/search/sorting operate on loaded posts; load more for older results. The leaderboard displays the rows returned by the game's leaderboard API, which may expose only its top ranks.
