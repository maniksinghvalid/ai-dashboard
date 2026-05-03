"use client";

function getRelativeTime(dateString: string): string {
  const then = new Date(dateString).getTime();
  if (isNaN(then)) return "";

  const now = Date.now();
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
      suppressHydrationWarning
      className={`text-xs text-gray-500 font-[family-name:var(--font-space-mono)] ${className}`}
    >
      {getRelativeTime(date)}
    </time>
  );
}
