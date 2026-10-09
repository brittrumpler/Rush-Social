# Rush Social

A social companion for the MarketRush simulated stock game: posts and jokes, verified trade receipts, a communal trade feed, likes, comments, profile pictures, live account worth and leaderboard rank, direct messages, and light/dark themes.

**Start with [START-HERE.md](START-HERE.md) to publish from GitHub.** This repository is standalone and needs no Codex or Sites account. Hosting uses Cloudflare Workers, D1 for shared data, and R2 for uploaded images. GitHub Pages does not support the backend.

## Local development

Install Node.js **24** and npm. In the extracted project folder:

```sh
npm ci
npm run dev
```

Open the local address printed in the terminal. The development command creates the local database and applies migrations automatically. Local database and image storage live in `.wrangler/`; they are separate from production. Local development does not require Cloudflare login. Game login still requires access to the original MarketRush server.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Run `npm run dev` at least once before using `preview` to initialize local tables. `npm ci` uses the committed lockfile; commit lockfile updates whenever dependencies change.

## Deploy from your computer instead

Create the Cloudflare resources described in START-HERE, then:

```sh
npm ci
npm run setup
npx wrangler login
npm run deploy
```

`setup` saves resource names and your non-secret database ID in `deploy.config.json`. Alternatively set `CLOUDFLARE_D1_DATABASE_ID` in your environment. GitHub Actions uses its repository variable to supply that ID. `wrangler.json` is generated and ignored; edit `deploy.config.json` rather than generated build files. Never commit API tokens, passwords, `.env`, `.dev.vars`, or local state.

## What is included

| Path | Purpose |
| --- | --- |
| `app/` | React UI, themes, and authenticated API routes |
| `lib/` | Game authentication, profile sync, and communal trade collection |
| `db/` | Database schema and Drizzle helper |
| `drizzle/` | Versioned SQL migrations; existing data survives updates |
| `worker/` | Cloudflare request entry point |
| `scripts/` | Local database setup and deployment configuration |
| `tests/` | Backend authorization, trade deduplication, and configuration checks |
| `.github/workflows/` | Pull-request checks and automatic deployment on main |

## Game integration and limits

The default game URL and **public publishable key** in `lib/game.ts` come from the supplied game client. They are not a service-role secret. Authentication verifies the game user server-side. The password goes directly from the browser to the game's Supabase Auth endpoint; Rush Social does not save it. Access and refresh tokens stay in browser memory, so reloading requires login again. API requests require a verified game token.

Profiles show cash, total worth, and global rank returned by the game. They refresh when profiles are fetched; they are not tick-by-tick portfolio valuations. Profile pictures and posts are stored in your Cloudflare account. DMs are restricted to their participants by the backend and are not end-to-end encrypted.

The communal feed imports recent trade histories exposed by the game's public profile API. While the feed is open, it polls about every 20 seconds and rotates through leaderboard players and Rush Social members, collecting up to eight profiles per collection cycle. Duplicate trades are ignored. The game does not expose a complete global trade stream, so unknown players, trades omitted by its history limit, and trades made while nobody visits can be missed. This is an observed trade feed, not a guarantee that every trade in the game is recorded. It does not place trades or predict hidden future events.

Uploaded photos accept JPEG, PNG, and WebP up to 5 MB. The R2 bucket stays private; authenticated app routes serve permitted photos. The project uses Vinext's Cloudflare integration with pinned dependency versions. Test updates before deploying them.

## Documentation

- [Cloudflare GitHub Actions deployments](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Create an R2 bucket](https://developers.cloudflare.com/r2/buckets/create-buckets/)

## Validation and dependency status

The release was checked with a clean npm install, TypeScript, the SQLite-backed API tests, and a production build. The updated framework removes the critical advisories reported against the original versions. npm audit still reports upstream advisories in the development dependency tree (including glob parsing and migration tooling). No non-breaking upstream fix was available at packaging time; review dependency updates before exposing development servers or processing untrusted build inputs.
