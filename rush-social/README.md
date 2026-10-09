# Rush Social

The market has a group chat. A responsive social companion to Market Rush, with posts, banter, photos, trade cards, comments, likes, bookmarks, profiles, and light/dark themes.

## Start here

**The project starts in demo mode.** Demo activity is stored in your browser, with fictional players and trades. It does not log into the game, send posts to other people, or change game data. Live functionality requires the setup below.

1. Put the contents of this folder at the root of your GitHub repository, including the hidden `.github` folder.
2. Under **Settings → Pages → Build and deployment**, select **GitHub Actions**. Push to the `main` branch. The included workflow tests and publishes the site.
3. For a local preview, run `npm run dev` (requires Python 3), or `python3 -m http.server 5173`, then visit `http://localhost:5173`. Node 22+ runs `npm test`. No npm install, runtime dependencies, or frontend build is needed.

GitHub Pages supports this workflow: [official deployment documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Connect your existing Market Rush accounts

The supplied game uses Supabase Auth with email/password. The live adapter uses the same Supabase project and its existing game RPCs. People sign in using their existing credentials; no second signup is required. A session on a different website origin cannot automatically be read, so visitors sign in once on Rush Social. This app uses its own session storage key to avoid competing with Market Rush's refresh token.

1. In the **existing Market Rush Supabase project**, have the owner review and run [`supabase/migrations/001_rush_social.sql`](supabase/migrations/001_rush_social.sql). Test on a staging copy first. The migration creates `rs_*` tables/functions and an upload bucket; it doesn't replace the game tables.
2. Configure the server-side trade hook described in [`docs/TRADE-INTEGRATION.md`](docs/TRADE-INTEGRATION.md). **Without that hook, automatic communal trade capture is not enabled.** The attachment did not include the database schema, so the actual game table/variable names must be supplied by the owner. Do not substitute a browser-only tracker.
3. Edit `config.js`: set `mode: 'live'`, confirm `supabaseUrl` and `supabasePublishableKey`, and set the game URL. The supplied public URL/key are already filled from the attachment. A publishable key is browser-safe; never add a service-role key or password to the repository.
4. Push the change. Sign in using an existing Market Rush email/password. Players without a game trader name should create it in Market Rush first.
5. Run the two-account checks in the integration guide before inviting everyone.

## What it does

- A social feed mixing posts, jokes, photos, and verified server-created trade activity.
- Profiles with editable display name, bio, and profile photo. The game remains the source of trader name, net worth, cash, and global rank.
- JPG, PNG, and WebP uploads up to 5 MB. Public media URLs, with uploads restricted to the signed-in player's own folder. Anyone with a media URL can view it, even though the live feed itself requires sign-in.
- Durable posts, comments, and likes through Supabase. Bookmarks and theme are stored on the current browser/device.
- Latest/most-liked sorting, category filters, search, and pagination. Search and sort cover loaded posts; load older pages to expand results.
- Shared trade feed refreshed every 15 seconds while the tab is active. Trade capture runs on the server even when Rush Social is closed. No WebSocket dependency.
- Responsive desktop sidebar and mobile bottom navigation. Mobile theme button and account settings are available on the profile page.
- GitHub Pages deployment workflow and automated unit tests.

The `mr_leaderboard` endpoint may return only the game's top players. Rush Social displays exactly those rows and can show any social author's full profile via `mr_profile`. It does not invent missing rankings.

## Repository layout

```text
index.html                     App shell
config.js                      Public runtime settings
favicon.svg                    Rush mark
src/styles.css                 Responsive light/dark styling
src/app.js                     UI and interactions
src/api.js                     Supabase Auth, REST, Storage and RPC adapter
src/demo.js                    Browser-persisted demo
src/model.js                   Validation, formatting, feed filtering
supabase/migrations/001_rush_social.sql
docs/TRADE-INTEGRATION.md      Server hook and staging checks
tests/model.test.mjs           Automated tests
.github/workflows/pages.yml    Test and deploy on main
```

## Data and access

The SQL enables Row Level Security and explicit grants. Users can edit only their own social profile, create their own posts/comments, and delete their own non-trade posts. Users cannot edit cash/rank, change trader identity, or create verified trade posts. The trade ingestion function is server-only. Likes use an authenticated RPC that serializes simultaneous toggles. These choices follow Supabase's [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function](https://supabase.com/docs/guides/database/functions) guidance.

User text is escaped before rendering, images reject executable URL schemes, and SVG uploads are excluded. Use HTTPS for deployment. Uploaded photo objects are retained if a post is deleted or an avatar is replaced; add an owner-controlled storage cleanup job if needed. Before opening beyond your friends, consider moderation, posting/upload quotas, and a retention policy. This version has no moderation dashboard.

## Verification

Nine automated tests cover escaping, URL safety, unknown money, upload limits, content validation, filtering, sorting, session refresh deduplication, and live post identity. The demo was browser-tested for posting, liking, bookmarking, comments, profile display, and responsive layouts. Live Supabase migrations, auth, policies, uploads, and the server hook have **not** been run against your friend's database; those need the owner's setup and staging verification.

Fonts load from Google Fonts with local system fallbacks. All money, prices, and trades are simulated game data.
