// Diagnostic: replicates the EXACT network requests from lib/api/reddit.ts and
// lib/api/twitter.ts to observe status codes locally. Does NOT call cacheSet.
// Run: npx tsx --env-file=.env.local scripts/diag-fetchers.ts
export {}; // standalone script — module scope so `main` doesn't collide globally

const SUBREDDITS = ["MachineLearning", "artificial", "LocalLLaMA", "ChatGPT", "singularity"];
const USER_AGENT =
  process.env.REDDIT_USER_AGENT ||
  "aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)";

const TWITTER_USERS = [
  { handle: "sama", userId: "3108351" },
  { handle: "ylecun", userId: "50705664" },
  { handle: "karpathy", userId: "33836629" },
  { handle: "fchollet", userId: "68746721" },
  { handle: "AnthropicAI", userId: "1353836358901501952" },
  { handle: "OpenAI", userId: "4398626122" },
  { handle: "GoogleDeepMind", userId: "4783690002" },
];

async function diagReddit() {
  console.log("\n=== REDDIT (www.reddit.com/r/*/hot.json) ===");
  console.log(`User-Agent: ${USER_AGENT}\n`);
  for (const sub of SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub}/hot.json?limit=25`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      let childCount = "n/a";
      let bodySample = "";
      const text = await res.text();
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          childCount = String(json?.data?.children?.length ?? "?");
        } catch {
          bodySample = ` | body not JSON: ${text.slice(0, 120)}`;
        }
      } else {
        bodySample = ` | body: ${text.slice(0, 160).replace(/\s+/g, " ")}`;
      }
      console.log(
        `r/${sub.padEnd(16)} ${res.status} ${res.statusText} | children=${childCount}${bodySample}`,
      );
    } catch (err) {
      console.log(`r/${sub.padEnd(16)} THREW: ${(err as Error).message}`);
    }
  }
}

async function diagTwitter() {
  console.log("\n=== TWITTER (api.x.com/2/users/:id/tweets) ===");
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.log("X_BEARER_TOKEN not set — fetchTweets() would return [] immediately.");
    return;
  }
  console.log(`X_BEARER_TOKEN: set (len ${token.length})\n`);
  for (const user of TWITTER_USERS) {
    const url = `https://api.x.com/2/users/${user.userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
