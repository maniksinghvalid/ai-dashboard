// Diagnostic: test alternative Reddit fetch strategies (old.reddit, .rss/Atom) for
// endpoint existence + data shape. Run from a RESIDENTIAL IP this only proves the
// endpoint works + what fields it returns — it does NOT prove the datacenter-IP
// 403 bypass (that can only be confirmed from Vercel).
// Run: npx tsx scripts/diag-reddit-alts.ts
export {}; // standalone script — module scope so `main` doesn't collide globally
const UA = "aip-dash/1.0 (https://github.com/maniksinghvalid/ai-dashboard)";
const SUBS = ["MachineLearning", "LocalLLaMA"];

const ENDPOINTS = (sub: string) => [
  { label: "www json (current)", url: `https://www.reddit.com/r/${sub}/hot.json?limit=25` },
  { label: "old json", url: `https://old.reddit.com/r/${sub}/hot.json?limit=25` },
  { label: "www .rss (Atom)", url: `https://www.reddit.com/r/${sub}/hot.rss?limit=25` },
  { label: "old .rss (Atom)", url: `https://old.reddit.com/r/${sub}/hot.rss?limit=25` },
];

function jsonShape(text: string): string {
  try {
    const j = JSON.parse(text);
    const first = j?.data?.children?.[0]?.data;
    if (!first) return `parsed, but no children`;
    const fields = ["title", "score", "num_comments", "link_flair_text", "permalink", "created_utc", "stickied", "over_18"];
    const present = fields.filter((f) => f in first);
    return `children=${j.data.children.length} | first-post fields: ${present.join(", ")}`;
  } catch {
    return `NOT JSON (${text.slice(0, 80).replace(/\s+/g, " ")})`;
  }
}

function rssShape(text: string): string {
  const entries = (text.match(/<entry>/g) || []).length;
  const hasTitle = /<title>/.test(text);
  const hasUpdated = /<updated>/.test(text);
  const hasAuthor = /<author>/.test(text);
  // Reddit RSS does NOT carry score / num_comments / flair as structured fields.
  const hasScore = /score/i.test(text.slice(0, 4000));
  return `<entry> count=${entries} | title=${hasTitle} updated=${hasUpdated} author=${hasAuthor} | score-field=${hasScore}`;
}

async function main() {
  console.log(`Reddit alt-endpoint diagnostic @ ${new Date().toISOString()}`);
  console.log(`(residential IP — proves endpoint+shape, NOT the Vercel 403 bypass)\n`);
  for (const sub of SUBS) {
    console.log(`--- r/${sub} ---`);
    for (const { label, url } of ENDPOINTS(sub)) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        const ct = res.headers.get("content-type") || "?";
        const text = await res.text();
        let shape = "";
        if (res.ok) {
          shape = url.includes(".rss") ? rssShape(text) : jsonShape(text);
        } else {
          shape = `body: ${text.slice(0, 100).replace(/\s+/g, " ")}`;
        }
        console.log(`  ${label.padEnd(20)} ${res.status} ${res.statusText} | ${ct.split(";")[0]}`);
        console.log(`  ${" ".repeat(20)} ${shape}`);
      } catch (err) {
        console.log(`  ${label.padEnd(20)} THREW: ${(err as Error).message}`);
      }
    }
    console.log("");
  }
}

main();
