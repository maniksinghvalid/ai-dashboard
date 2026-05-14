import { describe, it, expect } from "vitest";
import { SUBREDDITS, TWITTER_USERS, YOUTUBE_CHANNELS } from "@/lib/constants";

// Pure-data guards for the curated source lists. These catch the silent
// footguns: an X handle merged without its numeric userId returns zero tweets,
// a YouTube channel with a wrong uploadsPlaylistId returns no videos, and a
// stray aiFilter flag would narrow a subreddit nobody intended to filter.

describe("SUBREDDITS", () => {
  it("has 5 entries", () => {
    expect(SUBREDDITS.length).toBe(5);
  });

  it("every entry has a non-empty slug", () => {
    expect(
      SUBREDDITS.every((s) => typeof s.slug === "string" && s.slug.length > 0),
    ).toBe(true);
  });

  it("flags exactly r/programming for aiFilter", () => {
    const flagged = SUBREDDITS.filter(
      (s) => "aiFilter" in s && s.aiFilter === true,
    ).map((s) => s.slug);
    expect(flagged).toEqual(["programming"]);
  });
});

describe("TWITTER_USERS", () => {
  it("has 15 entries", () => {
    expect(TWITTER_USERS.length).toBe(15);
  });

  it("every entry has a non-empty handle", () => {
    expect(
      TWITTER_USERS.every(
        (u) => typeof u.handle === "string" && u.handle.length > 0,
      ),
    ).toBe(true);
  });

  it("every entry has a purely numeric userId", () => {
    expect(TWITTER_USERS.every((u) => /^\d+$/.test(u.userId))).toBe(true);
  });
});

describe("YOUTUBE_CHANNELS", () => {
  it("has 5 entries", () => {
    expect(YOUTUBE_CHANNELS.length).toBe(5);
  });

  it("every entry has a non-empty name", () => {
    expect(
      YOUTUBE_CHANNELS.every(
        (c) => typeof c.name === "string" && c.name.length > 0,
      ),
    ).toBe(true);
  });

  it("every uploadsPlaylistId is the channelId with the UC prefix swapped to UU", () => {
    expect(
      YOUTUBE_CHANNELS.every(
        (c) =>
          c.channelId.startsWith("UC") &&
          c.uploadsPlaylistId === "UU" + c.channelId.slice(2),
      ),
    ).toBe(true);
  });
});
