# T3X Sol Scanner

Live Solana explorer and swap router.

- Explorer: slots, blocks, transactions, wallets, and token mints (authorities, largest holders, balances).
- Router: best-route quotes plus single-venue comparisons, and unsigned swap transactions.
- HTTP API under `/api/*` — no key.

Chain data is read from public Solana RPC. Routes are quoted through Jupiter. The app never signs or broadcasts a transaction.

```bash
npm run dev
```
