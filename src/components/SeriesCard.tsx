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

/** Small pill that overlays the cover when the user has bookmarked this series. */
function BookmarkPill({ status }: { status?: BookmarkStatus }) {
  if (!status) return null;
  const meta = BOOKMARK_PILL[status];
  return (
    <span
      className={`absolute top-1 left-1 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-md ${meta.classes}`}
      title={`In your list: ${meta.label}`}
    >
      <Bookmark className="h-2.5 w-2.5 fill-current" />
      {meta.label}
    </span>
  );
}

/**
 * Horizontal mini card: small cover on LEFT, title + meta on RIGHT.
 * Used in homepage rails (Popular, New Releases, Continue Reading).
 * Compact, ~260px wide, 80px tall.
 */
export function CompactSeriesCard({
  series,
  subtitle,
  badge,
  progress,
}: {
  series: SeriesLike;
  subtitle?: string;
  badge?: React.ReactNode;
  progress?: number;
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group flex shrink-0 items-center gap-3 w-[260px] snap-start rounded-lg border border-border bg-card/40 p-2 hover:border-primary/50 hover:bg-card transition-colors"
    >
      <div className="relative h-[80px] w-[60px] shrink-0 overflow-hidden rounded-md bg-secondary">
        {series.cover_url ? (
          <img
            src={series.cover_url}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px]">No cover</div>
        )}
        {progress != null && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-1 truncate">{subtitle}</div>}
        {!subtitle && series.type && (
          <div className="text-[11px] text-muted-foreground mt-1">{typeLabel(series.type)}</div>
        )}
        {series.rating != null && (
          <div className="text-[11px] text-success mt-0.5 font-medium">★ {Number(series.rating).toFixed(1)}</div>
        )}
      </div>
      {badge && <div>{badge}</div>}
    </Link>
  );
}

/** Horizontal grid card for "Most Popular Ongoing" — small cover left, info right. */
export function GridSeriesCard({ series, genre }: { series: SeriesLike; genre?: string | null }) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card/40 p-2.5 hover:border-primary/50 hover:bg-card transition-colors"
    >
      <div className="relative h-[90px] w-[68px] shrink-0 overflow-hidden rounded-md bg-secondary">
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {genre && <div className="text-xs text-muted-foreground mt-1 truncate">{genre}</div>}
        {series.rating != null && (
          <div className="text-[11px] text-success mt-0.5 font-medium">★ {Number(series.rating).toFixed(1)}</div>
        )}
      </div>
    </Link>
  );
}

/** Horizontal chapter card (latest releases) — cover left, ch info right. */
export function ChapterCard({
  series,
  chapter_number,
  release_date,
  hasPublishedTranslation,
}: {
  series: SeriesLike;
  chapter_number: string;
  release_date?: string | null;
  hasPublishedTranslation?: boolean;
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group flex shrink-0 items-center gap-3 w-[260px] snap-start rounded-lg border border-border bg-card/40 p-2 hover:border-primary/50 hover:bg-card transition-colors"
    >
      <div className="relative h-[80px] w-[60px] shrink-0 overflow-hidden rounded-md bg-secondary">
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover" />
        )}
        <div className="absolute top-1 right-1 scale-75 origin-top-right">
          <StatusBadge status={hasPublishedTranslation ? "translated" : "new"} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between gap-2">
          <span>Ch. {chapter_number}</span>
          {release_date && <span className="truncate">{timeAgo(release_date)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function HorizontalRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 overflow-x-auto snap-x scrollbar-hide pb-2 -mx-4 px-4">
      {children}
    </div>
  );
}
