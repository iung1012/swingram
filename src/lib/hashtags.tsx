import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

// Same character class as the DB trigger so client + server agree.
const HASHTAG_RE = /#([A-Za-z0-9_\u00C0-\u017F]{1,50})/g;

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) set.add(m[1].toLowerCase());
  return Array.from(set);
}

export function renderCaption(text: string | null | undefined) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(HASHTAG_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const tag = m[1].toLowerCase();
    parts.push(
      <Link
        key={`h-${i++}-${start}`}
        to="/search"
        search={{ q: `#${tag}` } as never}
        className="text-primary hover:underline"
      >
        #{m[1]}
      </Link>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, idx) =>
    typeof p === "string" ? <Fragment key={`t-${idx}`}>{p}</Fragment> : p,
  );
}
