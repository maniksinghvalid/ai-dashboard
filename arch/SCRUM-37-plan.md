# SCRUM-37: Frontend Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AIP-Dash production dashboard — 7 widgets (excluding SentimentBar/SCRUM-42), 3-column responsive grid, SWR data fetching, skeleton loaders, per-widget error boundaries.

**Architecture:** Next.js 14 App Router with client-side SWR polling against 5 existing API routes. Server Component page renders a client DashboardShell that manages data fetching via per-resource hooks. All widgets wrapped in a shared WidgetCard with error boundary isolation.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, SWR, next/font/google (DM Sans + Space Mono)

---

## File Structure

```
app/
  layout.tsx                    [MODIFY] - Replace Geist fonts with DM Sans + Space Mono
  page.tsx                      [REPLACE] - Server Component rendering DashboardShell
  globals.css                   [MODIFY] - Update background, add platform color vars
  global-error.tsx              [MODIFY] - Update hardcoded background color

lib/
  types.ts                      [MODIFY] - Add HeroStory derived type
  hooks/
    use-api-data.ts             [CREATE] - Generic typed SWR hook for API routes
    use-dashboard.ts            [CREATE] - Facade composing all per-resource hooks

components/
  DashboardShell.tsx            [CREATE] - "use client" wrapper, data fetching, grid layout
  Header.tsx                    [CREATE] - Logo, LIVE badge, filter buttons
  LiveTicker.tsx                [CREATE] - CSS-animated scrolling ticker

  ui/
    PlatformBadge.tsx           [CREATE] - Reusable colored platform label
    RelativeTime.tsx            [CREATE] - "3h ago" formatter component

  widgets/
    WidgetCard.tsx              [CREATE] - Shared card chrome (title, border, padding)
    WidgetSkeleton.tsx          [CREATE] - Pulsing skeleton placeholder
    WidgetErrorBoundary.tsx     [CREATE] - React error boundary per widget
    YouTubeWidget.tsx           [CREATE] - Video cards with thumbnails
    RedditWidget.tsx            [CREATE] - Score + title + subreddit + comments
    XFeedWidget.tsx             [CREATE] - Tweet cards with engagement counts
    TrendingWidget.tsx          [CREATE] - Ranked topic chips with progress bars
    HeroStoryCard.tsx           [CREATE] - Top trending topic spotlight
    NewsWidget.tsx              [CREATE] - Headline list with source badges

tailwind.config.ts              [MODIFY] - Replace accent palette, add platform colors
```

---

## Existing Data Types (Reference)

From `lib/types.ts` — these are what widgets consume:

```typescript
// /api/youtube -> Video[]
{ id, title, channelName, channelId, thumbnailUrl, viewCount, publishedAt, viewVelocity, url }

// /api/reddit -> RedditPost[]
{ id, title, author, subreddit, score, numComments, flair, url, createdAt }

// /api/x -> Tweet[]
{ id, text, authorName, authorHandle, createdAt, likeCount, retweetCount, url }

// /api/news -> NewsItem[]
{ title, link, source, publishedAt, summary }

// /api/trending -> TrendingTopic[]
{ topic, mentionCount, velocity, sources, score }

// All routes return: ApiResponse<T> = { data: T, cachedAt: string | null, stale: boolean }
// 503 when no cached data: { data: [], cachedAt: null, stale: false, error: "No data available" }
```

---

## Task 1: Install SWR

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install SWR**

```bash
npm install swr
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('swr'); console.log('swr ok')"
```

Expected: `swr ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add swr dependency for client-side data fetching"
```

---

## Task 2: Update Design Tokens — Tailwind Config

**Files:**
- Modify: `tailwind.config.ts` (full file)

- [ ] **Step 1: Replace tailwind.config.ts**

Replace the entire file with the updated config. Changes: accent palette cyan -> purple, add `platform` colors, add `accent-glow` for the LIVE pulse.

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          50: "#f3f0ff",
          100: "#e9e3ff",
          200: "#d4c9ff",
          300: "#b5a1ff",
          400: "#9b7fff",
          500: "#7c6eff",
          600: "#6c4fff",
          700: "#5a3de6",
          800: "#4a32bf",
          900: "#3d2b99",
          950: "#231a5c",
        },
        "accent-secondary": "#c084fc",
        platform: {
          youtube: "#ff3333",
          reddit: "#ff5700",
          x: "#e7e7f0",
        },
        surface: {
          DEFAULT: "#111827",
          light: "#1f2937",
          dark: "#060610",
        },
      },
      spacing: {
        widget: "1.5rem",
        "widget-lg": "2rem",
      },
      fontSize: {
        "widget-title": [
          "1.125rem",
          { lineHeight: "1.5", fontWeight: "600" },
        ],
        "widget-value": ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
      },
      borderRadius: {
        widget: "0.75rem",
      },
      keyframes: {
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "ticker-scroll": "ticker-scroll 30s linear infinite",
        "live-pulse": "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Verify build**

```bash
npx tailwindcss --help > /dev/null 2>&1 && echo "tailwind ok"
```

Expected: `tailwind ok`

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: update design tokens — purple accent palette, platform colors, ticker animation"
```

---

## Task 3: Update CSS Variables & Fonts

**Files:**
- Modify: `app/globals.css` (full file)
- Modify: `app/layout.tsx` (full file)
- Modify: `app/global-error.tsx:19` (one line)

- [ ] **Step 1: Update globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #060610;
  --foreground: #e5e7eb;
}

body {
  color: var(--foreground);
  background: var(--background);
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 2: Update layout.tsx — replace Geist with DM Sans + Space Mono**

```typescript
import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Pulse Live Dashboard",
  description: "Real-time AI industry dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${spaceMono.variable} font-[family-name:var(--font-dm-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update global-error.tsx line 19 — change background color**

Change `background: "#0b1120"` to `background: "#060610"` on line 19.

```typescript
<body style={{ background: "#060610", color: "#e5e7eb" }}>
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -5
kill %1
```

Expected: HTML response with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx app/global-error.tsx
git commit -m "feat: switch to DM Sans + Space Mono fonts, update background to #060610"
```

---

## Task 4: Add HeroStory Derived Type

**Files:**
- Modify: `lib/types.ts` (append after line 50)

- [ ] **Step 1: Add HeroStory type**

Add after the `TrendingTopic` interface (after line 50):

```typescript
export interface HeroStory {
  topic: string;
  mentionCount: number;
  velocity: number;
  sources: string[];
  score: number;
  headline: string;
  thumbnailUrl: string | null;
  link: string | null;
}
```

This is a derived type — the client constructs it by cross-referencing the top `TrendingTopic` with matching YouTube/News content.

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add HeroStory derived type for hero card widget"
```

---

## Task 5: SWR Data Hooks

**Files:**
- Create: `lib/hooks/use-api-data.ts`
- Create: `lib/hooks/use-dashboard.ts`

- [ ] **Step 1: Create use-api-data.ts — generic typed SWR hook**

```typescript
"use client";

import useSWR from "swr";
import type { ApiResponse } from "@/lib/types";

const fetcher = async <T>(url: string): Promise<ApiResponse<T>> => {
  const res = await fetch(url);
  if (!res.ok && res.status !== 503) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

export function useApiData<T>(endpoint: string, refreshInterval = 60_000) {
  const { data, error, isLoading } = useSWR<ApiResponse<T>>(
    endpoint,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    },
  );

  return {
    data: data?.data ?? null,
    cachedAt: data?.cachedAt ?? null,
    stale: data?.stale ?? false,
    isLoading,
    error: error ?? null,
  };
}
```

Key design decisions:
- 503 is NOT thrown as an error — SWR gets `{ data: [], cachedAt: null, stale: false }` which the widget handles as empty state.
- Non-503 errors (500, network) ARE thrown — SWR surfaces them via `error`.
- `revalidateOnFocus: false` — dashboard polls on interval, no refetch on tab focus.
- `dedupingInterval: 10_000` — prevents duplicate requests within 10s.

- [ ] **Step 2: Create use-dashboard.ts — facade composing all hooks**

```typescript
"use client";

import { useApiData } from "@/lib/hooks/use-api-data";
import type {
  Video,
  RedditPost,
  Tweet,
  NewsItem,
  TrendingTopic,
} from "@/lib/types";

export function useDashboard() {
  const youtube = useApiData<Video[]>("/api/youtube");
  const reddit = useApiData<RedditPost[]>("/api/reddit");
  const twitter = useApiData<Tweet[]>("/api/x");
  const news = useApiData<NewsItem[]>("/api/news");
  const trending = useApiData<TrendingTopic[]>("/api/trending");

  return { youtube, reddit, twitter, news, trending };
}
```

Each resource has independent loading/error/stale state. One slow endpoint does not block others.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/use-api-data.ts lib/hooks/use-dashboard.ts
git commit -m "feat: add SWR data hooks — per-resource with independent states"
```

---

## Task 6: Shared UI Components

**Files:**
- Create: `components/ui/PlatformBadge.tsx`
- Create: `components/ui/RelativeTime.tsx`

- [ ] **Step 1: Create PlatformBadge.tsx**

```tsx
const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  youtube: { bg: "bg-platform-youtube/20", text: "text-platform-youtube", label: "YouTube" },
  reddit: { bg: "bg-platform-reddit/20", text: "text-platform-reddit", label: "Reddit" },
  twitter: { bg: "bg-platform-x/20", text: "text-platform-x", label: "X" },
};

export function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_STYLES[platform] ?? {
    bg: "bg-white/10",
    text: "text-gray-400",
    label: platform,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-[family-name:var(--font-space-mono)] ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
```

- [ ] **Step 2: Create RelativeTime.tsx**

```tsx
function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RelativeTime({
  date,
  className = "",
}: {
  date: string;
  className?: string;
}) {
  return (
    <time
      dateTime={date}
      className={`text-xs text-gray-500 font-[family-name:var(--font-space-mono)] ${className}`}
    >
      {getRelativeTime(date)}
    </time>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/PlatformBadge.tsx components/ui/RelativeTime.tsx
git commit -m "feat: add PlatformBadge and RelativeTime shared UI components"
```

---

## Task 7: Widget Infrastructure

**Files:**
- Create: `components/widgets/WidgetCard.tsx`
- Create: `components/widgets/WidgetSkeleton.tsx`
- Create: `components/widgets/WidgetErrorBoundary.tsx`
- Delete: `components/widgets/.gitkeep`

- [ ] **Step 1: Create WidgetCard.tsx**

```tsx
import type { ReactNode } from "react";

export function WidgetCard({
  title,
  stale = false,
  children,
}: {
  title: string;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-widget border border-white/10 bg-surface p-widget">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-widget-title text-foreground">{title}</h2>
        {stale && (
          <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 font-[family-name:var(--font-space-mono)]">
            outdated
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create WidgetSkeleton.tsx**

```tsx
export function WidgetSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="flex gap-3">
          {i === 0 && (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="flex-1 space-y-2">
            <div
              className="h-3 rounded bg-white/5"
              style={{ width: `${70 + ((i * 17) % 30)}%` }}
            />
            <div className="h-2 w-1/2 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create WidgetErrorBoundary.tsx**

```tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[120px] items-center justify-center rounded-widget border border-white/10 bg-surface p-widget text-center">
          <p className="text-sm text-gray-500">
            {this.props.fallbackTitle ?? "Feed unavailable"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Delete .gitkeep**

```bash
rm components/widgets/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add components/widgets/WidgetCard.tsx components/widgets/WidgetSkeleton.tsx components/widgets/WidgetErrorBoundary.tsx
git rm components/widgets/.gitkeep
git commit -m "feat: add WidgetCard, WidgetSkeleton, and WidgetErrorBoundary infrastructure"
```

---

## Task 8: YouTubeWidget

**Files:**
- Create: `components/widgets/YouTubeWidget.tsx`

- [ ] **Step 1: Create YouTubeWidget.tsx**

```tsx
import Image from "next/image";
import type { Video } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function VelocityBadge({ velocity }: { velocity: number }) {
  if (velocity <= 0) return null;
  const label =
    velocity >= 10_000 ? "Viral" : velocity >= 1_000 ? "Trending" : "Rising";
  const color =
    velocity >= 10_000
      ? "text-red-400 bg-red-400/20"
      : velocity >= 1_000
        ? "text-accent-400 bg-accent-400/20"
        : "text-green-400 bg-green-400/20";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium font-[family-name:var(--font-space-mono)] ${color}`}
    >
      {label}
    </span>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-white/5">
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {video.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span className="truncate">{video.channelName}</span>
          <span>&middot;</span>
          <span className="font-[family-name:var(--font-space-mono)]">
            {formatViewCount(video.viewCount)} views
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <RelativeTime date={video.publishedAt} />
          <VelocityBadge velocity={video.viewVelocity} />
        </div>
      </div>
    </a>
  );
}

export function YouTubeWidget({
  videos,
  stale,
  isLoading,
}: {
  videos: Video[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  return (
    <WidgetCard title="YouTube" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : !videos || videos.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No videos available
        </p>
      ) : (
        <div className="space-y-1">
          {videos.slice(0, 6).map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/YouTubeWidget.tsx
git commit -m "feat: add YouTubeWidget with thumbnails, velocity badges, view counts"
```

---

## Task 9: RedditWidget

**Files:**
- Create: `components/widgets/RedditWidget.tsx`

- [ ] **Step 1: Create RedditWidget.tsx**

```tsx
import type { RedditPost } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatScore(score: number): string {
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return score.toString();
}

function PostRow({ post }: { post: RedditPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
        <svg
          className="h-3 w-3 text-platform-reddit"
          viewBox="0 0 12 8"
          fill="currentColor"
        >
          <path d="M6 0L0 8h12z" />
        </svg>
        <span className="mt-0.5 text-xs font-bold font-[family-name:var(--font-space-mono)] text-foreground">
          {formatScore(post.score)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {post.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded bg-platform-reddit/20 px-1.5 py-0.5 text-platform-reddit font-[family-name:var(--font-space-mono)]">
            r/{post.subreddit}
          </span>
          {post.flair && (
            <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-accent-400">
              {post.flair}
            </span>
          )}
          <span className="font-[family-name:var(--font-space-mono)]">
            {post.numComments} comments
          </span>
          <RelativeTime date={post.createdAt} />
        </div>
      </div>
    </a>
  );
}

export function RedditWidget({
  posts,
  stale,
  isLoading,
}: {
  posts: RedditPost[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  return (
    <WidgetCard title="Reddit" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : !posts || posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No posts available
        </p>
      ) : (
        <div className="space-y-1">
          {posts.slice(0, 8).map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/RedditWidget.tsx
git commit -m "feat: add RedditWidget with score column, subreddit badges, flair tags"
```

---

## Task 10: XFeedWidget

**Files:**
- Create: `components/widgets/XFeedWidget.tsx`

- [ ] **Step 1: Create XFeedWidget.tsx**

Note: The `Tweet` type lacks `authorAvatarUrl`, `verified`, and `replyCount`. We use an initials-based avatar placeholder and render only available engagement metrics. No type changes needed — widget works with existing data.

```tsx
import type { Tweet } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-light text-xs font-bold text-gray-400">
      {initials}
    </div>
  );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <AuthorAvatar name={tweet.authorName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {tweet.authorName}
          </span>
          <span className="truncate text-xs text-gray-500">
            @{tweet.authorHandle}
          </span>
          <span className="text-gray-600">&middot;</span>
          <RelativeTime date={tweet.createdAt} />
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-gray-300">
          {tweet.text}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {formatCount(tweet.likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            {formatCount(tweet.retweetCount)}
          </span>
        </div>
      </div>
    </a>
  );
}

export function XFeedWidget({
  tweets,
  stale,
  isLoading,
}: {
  tweets: Tweet[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  return (
    <WidgetCard title="X / Twitter" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : !tweets || tweets.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No tweets available
        </p>
      ) : (
        <div className="space-y-1">
          {tweets.slice(0, 6).map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/XFeedWidget.tsx
git commit -m "feat: add XFeedWidget with initials avatars, engagement metrics"
```

---

## Task 11: TrendingWidget

**Files:**
- Create: `components/widgets/TrendingWidget.tsx`

- [ ] **Step 1: Create TrendingWidget.tsx**

```tsx
import type { TrendingTopic } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { PlatformBadge } from "@/components/ui/PlatformBadge";

function TopicChip({
  topic,
  rank,
  maxMentions,
}: {
  topic: TrendingTopic;
  rank: number;
  maxMentions: number;
}) {
  const barWidth = maxMentions > 0 ? (topic.mentionCount / maxMentions) * 100 : 0;

  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 font-[family-name:var(--font-space-mono)]">
            #{rank}
          </span>
          <span className="text-sm font-medium text-foreground">
            {topic.topic}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
          {topic.mentionCount} mentions
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent-500 transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {topic.sources.map((source) => (
          <PlatformBadge key={source} platform={source} />
        ))}
        <span className="ml-auto text-[10px] text-gray-500 font-[family-name:var(--font-space-mono)]">
          {topic.velocity.toFixed(1)}/hr
        </span>
      </div>
    </div>
  );
}

export function TrendingWidget({
  topics,
  stale,
  isLoading,
}: {
  topics: TrendingTopic[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  const maxMentions = topics?.[0]?.mentionCount ?? 0;

  return (
    <WidgetCard title="Trending Topics" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : !topics || topics.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No trending topics
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {topics.slice(0, 8).map((topic, i) => (
            <TopicChip
              key={topic.topic}
              topic={topic}
              rank={i + 1}
              maxMentions={maxMentions}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/TrendingWidget.tsx
git commit -m "feat: add TrendingWidget with ranked chips, progress bars, velocity"
```

---

## Task 12: HeroStoryCard

**Files:**
- Create: `components/widgets/HeroStoryCard.tsx`

- [ ] **Step 1: Create HeroStoryCard.tsx**

The hero card takes the top `TrendingTopic` and cross-references it with YouTube videos and news items to build a richer display. If no match is found, it falls back to a topic-only spotlight.

```tsx
import Image from "next/image";
import type { Video, NewsItem, TrendingTopic, HeroStory } from "@/lib/types";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { PlatformBadge } from "@/components/ui/PlatformBadge";

export function deriveHeroStory(
  topics: TrendingTopic[] | null,
  videos: Video[] | null,
  news: NewsItem[] | null,
): HeroStory | null {
  if (!topics || topics.length === 0) return null;

  const top = topics[0];
  const topicLower = top.topic.toLowerCase();

  const matchingVideo = videos?.find((v) =>
    v.title.toLowerCase().includes(topicLower),
  );
  const matchingNews = news?.find((n) =>
    n.title.toLowerCase().includes(topicLower),
  );

  return {
    topic: top.topic,
    mentionCount: top.mentionCount,
    velocity: top.velocity,
    sources: top.sources,
    score: top.score,
    headline:
      matchingNews?.title ?? matchingVideo?.title ?? `${top.topic} is trending`,
    thumbnailUrl: matchingVideo?.thumbnailUrl ?? null,
    link: matchingNews?.link ?? matchingVideo?.url ?? null,
  };
}

export function HeroStoryCard({
  topics,
  videos,
  news,
  isLoading,
}: {
  topics: TrendingTopic[] | null;
  videos: Video[] | null;
  news: NewsItem[] | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-widget border border-accent-500/30 bg-gradient-to-br from-accent-950/50 to-surface p-widget-lg">
        <WidgetSkeleton lines={3} />
      </div>
    );
  }

  const hero = deriveHeroStory(topics, videos, news);

  if (!hero) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-widget border border-white/10 bg-surface p-widget">
        <p className="text-sm text-gray-500">No trending stories</p>
      </div>
    );
  }

  const Wrapper = hero.link ? "a" : "div";
  const linkProps = hero.link
    ? { href: hero.link, target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className="group relative block overflow-hidden rounded-widget border border-accent-500/30 bg-gradient-to-br from-accent-950/50 to-surface p-widget-lg transition-colors hover:border-accent-500/50"
    >
      {hero.thumbnailUrl && (
        <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity">
          <Image
            src={hero.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-xs font-semibold text-accent-400 font-[family-name:var(--font-space-mono)]">
            TOP STORY
          </span>
          <span className="text-xs text-gray-500 font-[family-name:var(--font-space-mono)]">
            {hero.mentionCount} mentions &middot; {hero.velocity.toFixed(1)}/hr
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold text-foreground leading-snug">
          {hero.headline}
        </h3>
        <div className="mt-3 flex items-center gap-2">
          {hero.sources.map((source) => (
            <PlatformBadge key={source} platform={source} />
          ))}
        </div>
      </div>
    </Wrapper>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/HeroStoryCard.tsx
git commit -m "feat: add HeroStoryCard — top trending topic with cross-platform context"
```

---

## Task 13: NewsWidget

**Files:**
- Create: `components/widgets/NewsWidget.tsx`

- [ ] **Step 1: Create NewsWidget.tsx**

```tsx
import type { NewsItem } from "@/lib/types";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";
import { RelativeTime } from "@/components/ui/RelativeTime";

const SOURCE_COLORS: Record<string, string> = {
  "The Verge AI": "bg-purple-500/20 text-purple-400",
  "MIT Tech Review AI": "bg-red-500/20 text-red-400",
  "ArXiv cs.AI": "bg-blue-500/20 text-blue-400",
};

function NewsRow({ item }: { item: NewsItem }) {
  const colorClass = SOURCE_COLORS[item.source] ?? "bg-white/10 text-gray-400";

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1 rounded-lg p-2 transition-colors hover:bg-white/5"
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium font-[family-name:var(--font-space-mono)] ${colorClass}`}
        >
          {item.source}
        </span>
        <RelativeTime date={item.publishedAt} />
      </div>
      <p className="line-clamp-2 text-sm font-medium text-foreground">
        {item.title}
      </p>
    </a>
  );
}

export function NewsWidget({
  items,
  stale,
  isLoading,
}: {
  items: NewsItem[] | null;
  stale: boolean;
  isLoading: boolean;
}) {
  return (
    <WidgetCard title="News" stale={stale}>
      {isLoading ? (
        <WidgetSkeleton lines={5} />
      ) : !items || items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No news available
        </p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((item, i) => (
            <NewsRow key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/widgets/NewsWidget.tsx
git commit -m "feat: add NewsWidget with color-coded source badges"
```

---

## Task 14: Header & LiveTicker

**Files:**
- Create: `components/Header.tsx`
- Create: `components/LiveTicker.tsx`

- [ ] **Step 1: Create Header.tsx**

```tsx
export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">
          AI Pulse
        </h1>
        <span className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400 font-[family-name:var(--font-space-mono)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-green-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          LIVE
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create LiveTicker.tsx**

```tsx
import type { TrendingTopic } from "@/lib/types";

export function LiveTicker({ topics }: { topics: TrendingTopic[] | null }) {
  if (!topics || topics.length === 0) return null;

  const items = topics.slice(0, 10);
  // Duplicate for seamless loop
  const tickerContent = [...items, ...items];

  return (
    <div
      className="overflow-hidden border-b border-white/5 bg-surface-dark py-2"
      aria-live="polite"
    >
      <div className="animate-ticker-scroll flex whitespace-nowrap"
        style={{ willChange: "transform" }}
      >
        {tickerContent.map((topic, i) => (
          <span
            key={`${topic.topic}-${i}`}
            className="mx-4 inline-flex items-center gap-2 text-xs"
          >
            <span className="font-medium text-foreground">{topic.topic}</span>
            <span className="text-accent-400 font-[family-name:var(--font-space-mono)]">
              {topic.mentionCount} mentions
            </span>
            <span className="text-green-400 font-[family-name:var(--font-space-mono)]">
              +{topic.velocity.toFixed(1)}/hr
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Header.tsx components/LiveTicker.tsx
git commit -m "feat: add Header with LIVE pulse badge and LiveTicker with CSS scroll animation"
```

---

## Task 15: DashboardShell & Page

**Files:**
- Create: `components/DashboardShell.tsx`
- Replace: `app/page.tsx` (full rewrite)

- [ ] **Step 1: Create DashboardShell.tsx**

```tsx
"use client";

import { useDashboard } from "@/lib/hooks/use-dashboard";
import { Header } from "@/components/Header";
import { LiveTicker } from "@/components/LiveTicker";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import { YouTubeWidget } from "@/components/widgets/YouTubeWidget";
import { RedditWidget } from "@/components/widgets/RedditWidget";
import { XFeedWidget } from "@/components/widgets/XFeedWidget";
import { TrendingWidget } from "@/components/widgets/TrendingWidget";
import { HeroStoryCard } from "@/components/widgets/HeroStoryCard";
import { NewsWidget } from "@/components/widgets/NewsWidget";

export function DashboardShell() {
  const { youtube, reddit, twitter, news, trending } = useDashboard();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LiveTicker topics={trending.data as import("@/lib/types").TrendingTopic[] | null} />

      <main className="mx-auto max-w-[1440px] p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {/* Left Column: YouTube + Reddit */}
          <div className="space-y-4 lg:space-y-6">
            <WidgetErrorBoundary fallbackTitle="YouTube feed unavailable">
              <YouTubeWidget
                videos={youtube.data as import("@/lib/types").Video[] | null}
                stale={youtube.stale}
                isLoading={youtube.isLoading}
              />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary fallbackTitle="Reddit feed unavailable">
              <RedditWidget
                posts={reddit.data as import("@/lib/types").RedditPost[] | null}
                stale={reddit.stale}
                isLoading={reddit.isLoading}
              />
            </WidgetErrorBoundary>
          </div>

          {/* Center Column: Hero + Trending */}
          <div className="space-y-4 lg:space-y-6">
            <WidgetErrorBoundary fallbackTitle="Story unavailable">
              <HeroStoryCard
                topics={trending.data as import("@/lib/types").TrendingTopic[] | null}
                videos={youtube.data as import("@/lib/types").Video[] | null}
                news={news.data as import("@/lib/types").NewsItem[] | null}
                isLoading={trending.isLoading}
              />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary fallbackTitle="Trending unavailable">
              <TrendingWidget
                topics={trending.data as import("@/lib/types").TrendingTopic[] | null}
                stale={trending.stale}
                isLoading={trending.isLoading}
              />
            </WidgetErrorBoundary>

            {/* SentimentBar placeholder — SCRUM-42 */}
          </div>

          {/* Right Column: X + News */}
          <div className="space-y-4 lg:space-y-6">
            <WidgetErrorBoundary fallbackTitle="X feed unavailable">
              <XFeedWidget
                tweets={twitter.data as import("@/lib/types").Tweet[] | null}
                stale={twitter.stale}
                isLoading={twitter.isLoading}
              />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary fallbackTitle="News feed unavailable">
              <NewsWidget
                items={news.data as import("@/lib/types").NewsItem[] | null}
                stale={news.stale}
                isLoading={news.isLoading}
              />
            </WidgetErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Replace app/page.tsx**

```tsx
import { DashboardShell } from "@/components/DashboardShell";

export default function Home() {
  return <DashboardShell />;
}
```

- [ ] **Step 3: Verify dev server renders the dashboard**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -o "AI Pulse" | head -1
kill %1
```

Expected: `AI Pulse`

- [ ] **Step 4: Commit**

```bash
git add components/DashboardShell.tsx app/page.tsx
git commit -m "feat: add DashboardShell with 3-column grid layout and wire all widgets"
```

---

## Task 16: Responsive Breakpoints & Polish

**Files:**
- Modify: `components/DashboardShell.tsx` (verify responsive behavior)

- [ ] **Step 1: Verify responsive classes are correct**

The grid in DashboardShell uses:
- `grid-cols-1` (mobile, <1024px) — single column stack
- `lg:grid-cols-3` (>=1024px) — 3-column layout

For tablet (768-1023px), the single column is correct per the acceptance criteria ("degrades gracefully to single column on mobile"). If a 2-column intermediate is desired later, add `md:grid-cols-2` — but the ticket does not require it.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or lint errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Fix any lint/type errors found in Steps 2-3**

Address any issues. Common ones:
- Missing `alt` attributes on images (already handled)
- Unused imports
- `any` types (already avoided)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: fix lint/type errors, verify responsive breakpoints"
```

---

## Task 17: Accessibility Pass

**Files:**
- Modify: `components/LiveTicker.tsx`
- Modify: `components/Header.tsx`

- [ ] **Step 1: Add prefers-reduced-motion to LiveTicker**

In `LiveTicker.tsx`, add a media query check. Update the ticker div:

```tsx
<div
  className="animate-ticker-scroll flex whitespace-nowrap motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:gap-4"
  style={{ willChange: "transform" }}
>
```

Tailwind's `motion-reduce:` variant respects `prefers-reduced-motion: reduce`. When active, the ticker stops scrolling and wraps normally.

- [ ] **Step 2: Add prefers-reduced-motion to LIVE pulse**

In `Header.tsx`, update the pulse span:

```tsx
<span className="absolute inline-flex h-full w-full animate-live-pulse motion-reduce:animate-none rounded-full bg-green-400" />
```

- [ ] **Step 3: Commit**

```bash
git add components/LiveTicker.tsx components/Header.tsx
git commit -m "a11y: respect prefers-reduced-motion for ticker and pulse animations"
```

---

## Acceptance Criteria Mapping

| Criterion | Task(s) | How verified |
|-----------|---------|--------------|
| All 7 widgets render with live data (excl. SentimentBar) | Tasks 8-14 | Visual check on dev server with populated cache |
| Dashboard auto-refreshes without full page reload | Task 5 (SWR 60s polling) | Network tab shows periodic fetches, UI updates |
| Skeleton states shown during initial load | Tasks 7-13 (each widget has skeleton) | Throttle network, observe skeletons |
| Responsive: 1280px+ works, mobile single column | Task 15-16 | Resize browser, verify grid collapse |
| Lighthouse Performance >= 85 | Tasks 3 (font swap), 8 (next/image), 16 (build) | Run Lighthouse on production build |

---

## Known Limitations (Documented, Not Blocked)

| Limitation | Reason | Future fix |
|-----------|--------|------------|
| XFeedWidget lacks avatars, verified badges, reply counts | `Tweet` type missing fields | Extend Twitter API client + type in separate ticket |
| SentimentBar not included | Descoped to SCRUM-42 | Implement SCRUM-42, drop into center column |
| LiveTicker has no delta counts | No historical data for comparison | Add `previousMentionCount` to TrendingTopic |
| HeroStoryCard uses simple string matching | Cross-referencing by topic keyword | Improve with NLP/embedding similarity later |
| Filter buttons (All/Models/Research/Products) not functional | No filtering logic specified | Add as separate ticket |
