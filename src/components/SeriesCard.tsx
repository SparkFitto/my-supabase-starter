import { Link } from "@tanstack/react-router";
import { typeLabel, timeAgo } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

interface SeriesLike {
  slug: string;
  title: string;
  cover_url?: string | null;
  type?: string | null;
  rating?: number | null;
}

/**
 * Compact horizontal-row card. ~125x170 cover.
 * Used in Popular / New Releases / Continue Reading rows.
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
  progress?: number; // 0..1
}) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group flex shrink-0 flex-col w-[125px] snap-start"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
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
        {series.rating != null && (
          <span className="absolute bottom-1.5 left-1.5 bg-success text-background text-[10px] font-bold px-1.5 py-0.5 rounded">
            ★ {Number(series.rating).toFixed(1)}
          </span>
        )}
        {badge && (
          <div className="absolute top-1.5 right-1.5">{badge}</div>
        )}
        {progress != null && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-xs font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
        {series.type && !subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{typeLabel(series.type)}</div>}
      </div>
    </Link>
  );
}

/** Grid card for Most Popular Ongoing (slightly bigger, shows genre). */
export function GridSeriesCard({ series, genre }: { series: SeriesLike; genre?: string | null }) {
  return (
    <Link
      to="/series/$slug"
      params={{ slug: series.slug }}
      className="group flex flex-col"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
        )}
        {series.rating != null && (
          <span className="absolute bottom-2 left-2 bg-success text-background text-xs font-bold px-1.5 py-0.5 rounded">
            ★ {Number(series.rating).toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        {genre && <div className="text-xs text-muted-foreground mt-0.5 truncate">{genre}</div>}
      </div>
    </Link>
  );
}

/** Tiny chapter card (latest releases) — shows series cover, ch number, time, status. */
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
      className="group flex shrink-0 flex-col w-[125px] snap-start"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary border border-border group-hover:border-primary/50 transition-colors">
        {series.cover_url && (
          <img src={series.cover_url} alt={series.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
        )}
        <div className="absolute top-1.5 right-1.5">
          <StatusBadge status={hasPublishedTranslation ? "translated" : "new"} />
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-xs font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{series.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-between">
          <span>Ch. {chapter_number}</span>
          {release_date && <span>{timeAgo(release_date)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function HorizontalRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4">
      {children}
    </div>
  );
}
