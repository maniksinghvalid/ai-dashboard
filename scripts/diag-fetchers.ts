// Diagnostic: replicates the EXACT network requests from lib/api/reddit.ts and
// lib/api/twitter.ts to observe status codes locally. Does NOT call cacheSet.
// Run: npx tsx --env-file=.env.local scripts/diag-fetchers.ts
import { SUBREDDITS, TWITTER_USERS } from "@/lib/constants";

const USER_AGENT =
  process.env.REDDIT_USER_AGENT ||
  "aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)";

async function diagReddit() {
  console.log("\n=== REDDIT (www.reddit.com/r/*/hot.rss) ===");
  console.log(`User-Agent: ${USER_AGENT}\n`);
  for (const sub of SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub.slug}/hot.rss?limit=25`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const text = await res.text();
      let info = "";
      if (res.ok) {
        const entryCount = (text.match(/<entry/g) ?? []).length;
        info = `entries=${entryCount}`;
      } else {
        info = `body: ${text.slice(0, 160).replace(/\s+/g, " ")}`;
      }
      console.log(
        `r/${sub.slug.padEnd(16)} ${res.status} ${res.statusText} | ${info}`,
      );
    } catch (err) {
      console.log(`r/${sub.slug.padEnd(16)} THREW: ${(err as Error).message}`);
    }
  }
}

async function diagTwitter() {
  console.log("\n=== TWITTER (api.x.com/2/users/:id/tweets) ===");
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.log(
      "X_BEARER_TOKEN not set — fetchTweets() would return [] immediately.",
    );
    return;
  }
  console.log(`X_BEARER_TOKEN: set (len ${token.length})\n`);
  for (const user of TWITTER_USERS) {
    const url = `https://api.x.com/2/users/${user.userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let info = "";
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          info = `data.length=${json?.data?.length ?? "?"}`;
        } catch {
          info = `body not JSON: ${text.slice(0, 120)}`;
        }
      } else {
        info = `body: ${text.slice(0, 200).replace(/\s+/g, " ")}`;
      }
      const rl = res.headers.get("x-rate-limit-remaining");
      console.log(
        `@${user.handle.padEnd(16)} ${res.status} ${res.statusText} | rl-remaining=${rl ?? "n/a"} | ${info}`,
      );
    } catch (err) {
      console.log(`@${user.handle.padEnd(16)} THREW: ${(err as Error).message}`);
    }
  }
}

async function main() {
  console.log(`Local diagnostic run @ ${new Date().toISOString()}`);
  await diagReddit();
  await diagTwitter();
}

main();
