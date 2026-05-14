import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "1"),

    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    debug: false,

    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Chunk-load failures (usually a stale deploy or a flaky network) are not
    // application bugs. They reach Sentry in two shapes; the next two filters
    // each handle one. Shape 1: a real Error whose message matches below.
    ignoreErrors: [/ChunkLoadError/, /Loading chunk [\w-]+ failed/],

    beforeSend(event, hint) {
      // Shape 2: webpack's import() machinery rejects with the bare DOM `error`
      // Event from a failed <script> — not an Error, no stack, not actionable.
      // This codebase never rejects promises with DOM Event objects, so the
      // `instanceof Event` check only ever catches chunk-load noise — revisit
      // if that changes. console.warn keeps the frequency visible in browser
      // logs even though the Sentry event is dropped.
      if (typeof Event !== "undefined" && hint?.originalException instanceof Event) {
        console.warn("[sentry] dropped Event-shaped promise rejection (chunk load?)");
        return null;
      }
      return event;
    },
  });
}

// TODO: Enable when upgrading to Next.js 15 (not called on Next.js 14)
// export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
