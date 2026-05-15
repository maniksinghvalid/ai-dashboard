import { describe, it, expect } from "vitest";
import { SUBREDDITS, TWITTER_USERS, YOUTUBE_CHANNELS } from "@/lib/constants";

// Pure-data guards for the curated source lists. These catch the silent
// footguns: an X handle merged without its numeric userId returns zero tweets,
// a YouTube channel with a wrong uploadsPlaylistId returns no videos, and a
// stray aiFilter flag would narrow a subreddit nobody intended to filter.

describe("SUBREDDITS", () => {
  // Count is asserted deliberately: a change to the curated list should be an
  // intentional curation decision, not an accidental add/drop. Update the
  // number here when the list legitimately changes.
  it("has 5 entries", () => {
    expect(SUBREDDITS.length).toBe(5);
  });

  it("every entry has a non-empty slug", () => {
    expect(
      SUBREDDITS.every((s) => typeof s.slug === "string" && s.slug.length > 0),
    ).toBe(true);
  });

  it("has no duplicate slugs", () => {
    const slugs = SUBREDDITS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
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

  it("has no duplicate handles or userIds", () => {
    const handles = TWITTER_USERS.map((u) => u.handle);
    const ids = TWITTER_USERS.map((u) => u.userId);
    expect(new Set(handles).size).toBe(handles.length);
    expect(new Set(ids).size).toBe(ids.length);
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

  it("has no duplicate channelIds", () => {
    const ids = YOUTUBE_CHANNELS.map((c) => c.channelId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
