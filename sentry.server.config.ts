import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "1"),

    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    debug: false,
  });
}
