import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { typeLabel, timeAgo } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { BOOKMARK_PILL, type BookmarkStatus } from "@/lib/use-bookmarks";

interface SeriesLike {
  id?: string;
  slug: string;
  title: string;
  cover_url?: string | null;
  type?: string | null;
  rating?: number | null;
}

/**
 * Small pill that overlays the cover when the user has bookmarked this series.
 * Compact: small icon + short label, lives in the top-right so it doesn't crop
 * with the rounded corners and stays fully visible at any card size.
 */
function BookmarkPill({ status }: { status?: BookmarkStatus }) {
  if (!status) return null;
  const meta = BOOKMARK_PILL[status];
  return (
    <span
      className={`absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none shadow-md whitespace-nowrap ${meta.classes}`}
      title={`In your list: ${meta.label}`}
    >
      <Bookmark className="h-2.5 w-2.5 fill-current" />
      {meta.label}
    </span>
  );
}

/**
 * Vertical mini card: cover on TOP, title + meta BELOW.
 * Used in homepage rails (Popular, New Releases, Continue Reading).
 */
export function CompactSeriesCard({
  series,
  subtitle,
  badge,
  progress,
  bookmarkStatus,
}: {
  series: SeriesLike;
  subtitle?: string;
  badge?: React.ReactNode;
  progress?: number;
  bookmarkStatus?: BookmarkStatus;
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group shrink-0 w-[140px] snap-start"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
        <BookmarkPill status={bookmarkStatus} />
        {series.cover_url ? (
          <img
            src={series.cover_url}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No cover</div>
        )}
        {progress != null && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        )}
        {badge && <div className="absolute bottom-1.5 left-1.5">{badge}</div>}
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
        {!subtitle && series.type && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{typeLabel(series.type)}</div>
        )}
        {series.rating != null && (
          <div className="text-[11px] text-success mt-0.5 font-medium">★ {Number(series.rating).toFixed(1)}</div>
        )}
      </div>
    </Link>
  );
}

/** Vertical grid card for "Most Popular Ongoing" — cover on top, info below. */
export function GridSeriesCard({
  series,
  genre,
  bookmarkStatus,
}: {
  series: SeriesLike;
  genre?: string | null;
  bookmarkStatus?: BookmarkStatus;
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group block"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
        <BookmarkPill status={bookmarkStatus} />
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {genre && <div className="text-xs text-muted-foreground mt-0.5 truncate">{genre}</div>}
        {series.rating != null && (
          <div className="text-[11px] text-success mt-0.5 font-medium">★ {Number(series.rating).toFixed(1)}</div>
        )}
      </div>
    </Link>
  );
}

/** Vertical chapter card (latest releases) — cover on top, ch info below. */
export function ChapterCard({
  series,
  chapter_number,
  release_date,
  hasPublishedTranslation,
  bookmarkStatus,
}: {
  series: SeriesLike;
  chapter_number: string;
  release_date?: string | null;
  hasPublishedTranslation?: boolean;
  bookmarkStatus?: BookmarkStatus;
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group shrink-0 w-[140px] snap-start"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
        <BookmarkPill status={bookmarkStatus} />
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
        )}
        <div className="absolute bottom-1.5 left-1.5 scale-90 origin-bottom-left">
          <StatusBadge status={hasPublishedTranslation ? "translated" : "new"} />
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-between gap-2">
          <span>Ch. {chapter_number}</span>
          {release_date && <span className="truncate">{timeAgo(release_date)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function HorizontalRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x scrollbar-hide pb-2 -mx-4 px-4">
      {children}
    </div>
  );
}
