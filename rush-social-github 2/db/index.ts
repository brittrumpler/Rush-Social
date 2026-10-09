import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Run npm run dev locally, or configure your D1 database in deploy.config.json before deploying."
    );
  }

  return drizzle(env.DB, { schema });
}
