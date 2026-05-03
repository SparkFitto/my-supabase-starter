import * as React from "react";
import { cn } from "@/lib/utils";

interface SwipeTabsProps {
  tabs: { key: string; label: string }[];
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode; // panels rendered in order matching tabs
  className?: string;
}

/**
 * Mobile-first swipeable tabs. Fingers slide between panels horizontally;
 * tab triggers stay non-scrolling (no scrollbar).
 */
export function SwipeTabs({ tabs, value, onValueChange, children, className }: SwipeTabsProps) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === value));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const startX = React.useRef<number | null>(null);
  const dx = React.useRef(0);
  const [drag, setDrag] = React.useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dx.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    dx.current = e.touches[0].clientX - startX.current;
    setDrag(dx.current);
  };
  const onTouchEnd = () => {
    const w = containerRef.current?.offsetWidth ?? 1;
    if (Math.abs(dx.current) > w * 0.18) {
      if (dx.current < 0 && idx < tabs.length - 1) onValueChange(tabs[idx + 1].key);
      else if (dx.current > 0 && idx > 0) onValueChange(tabs[idx - 1].key);
    }
    startX.current = null;
    dx.current = 0;
    setDrag(0);
  };

  const panels = React.Children.toArray(children);

  return (
    <div className={className}>
      <div className="flex w-full border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onValueChange(t.key)}
            className={cn(
              "flex-1 px-2 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
              t.key === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex w-full"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${drag}px))`,
            transition: startX.current == null ? "transform 0.25s ease" : "none",
          }}
        >
          {panels.map((p, i) => (
            <div key={i} className="w-full shrink-0 px-0.5 pt-3">
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
