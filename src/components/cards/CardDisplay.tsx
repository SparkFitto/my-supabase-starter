import { cn } from "@/lib/utils";

// Ranks: X (top) → G (bottom). Special holographic ranks (T,H,N,V,L,K,Q) are reserved for events.
export type CardRank =
  | "X" | "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G"
  | "T" | "H" | "N" | "V" | "L" | "K" | "Q";

export interface CardData {
  id: string;
  name: string;
  character_name: string;
  image_url: string;
  rank: CardRank;
  is_animated?: boolean;
  series?: { slug: string; title: string } | null;
}

export interface UserCardData {
  id: string;
  quantity: number;
  frame_level: number;
  is_blocked?: boolean;
  is_trade_ready?: boolean;
}

interface Props {
  card: CardData;
  userCard?: UserCardData;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  showOwnerCount?: boolean;
  ownerCount?: number;
  className?: string;
}

const SIZES = {
  sm: "w-[90px] h-[126px]",
  md: "w-[120px] h-[168px]",
  lg: "w-[160px] h-[224px]",
} as const;

const BADGE_SIZE = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-7 w-7 text-sm",
} as const;

const RANK_BORDER: Record<CardRank, string> = {
  X: "border-2 border-teal-400 shadow-lg shadow-teal-400/50",
  S: "border-2 border-purple-500 shadow-lg shadow-purple-500/40",
  A: "border-2 border-red-700",
  B: "border-2 border-pink-500",
  C: "border-2 border-yellow-600",
  D: "border-2 border-stone-600",
  E: "border-2 border-amber-900",
  F: "border-2 border-blue-500",
  G: "border-2 border-green-600",
  T: "border-2 border-yellow-400 shadow-lg shadow-yellow-400/50",
  H: "border-2 border-rose-400 shadow-lg shadow-rose-400/40",
  N: "border-2 border-sky-400 shadow-lg shadow-sky-400/40",
  V: "border-2 border-violet-400 shadow-lg shadow-violet-400/40",
  L: "border-2 border-lime-400 shadow-lg shadow-lime-400/40",
  K: "border-2 border-fuchsia-400 shadow-lg shadow-fuchsia-400/40",
  Q: "border-2 border-orange-400 shadow-lg shadow-orange-400/40",
};

const RANK_BADGE_BG: Record<CardRank, string> = {
  X: "bg-teal-400 text-black",
  S: "bg-purple-500",
  A: "bg-red-700",
  B: "bg-pink-500",
  C: "bg-yellow-600",
  D: "bg-stone-600",
  E: "bg-amber-900",
  F: "bg-blue-500",
  G: "bg-green-600",
  T: "bg-yellow-400 text-black",
  H: "bg-rose-400",
  N: "bg-sky-400",
  V: "bg-violet-400",
  L: "bg-lime-400 text-black",
  K: "bg-fuchsia-400",
  Q: "bg-orange-400 text-black",
};

export function CardDisplay({
  card,
  userCard,
  size = "md",
  onClick,
  showOwnerCount,
  ownerCount,
  className,
}: Props) {
  const isFrameMax = userCard?.frame_level === 7;
  const isClickable = !!onClick;

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        className={cn(
          "relative overflow-hidden rounded-xl bg-secondary",
          SIZES[size],
          RANK_BORDER[card.rank],
          isFrameMax && "animate-pulse",
          isClickable && "cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]",
        )}
      >
        <img
          src={card.image_url}
          alt={card.character_name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />

        {/* Rank badge */}
        <div
          className={cn(
            "absolute left-1.5 top-1.5 flex items-center justify-center rounded-full font-bold text-white shadow-md",
            BADGE_SIZE[size],
            RANK_BADGE_BG[card.rank],
          )}
        >
          {card.rank}
        </div>

        {/* Quantity badge (top-right) */}
        {userCard && userCard.quantity > 1 && (
          <div className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
            ×{userCard.quantity}
          </div>
        )}

        {/* Locked overlay */}
        {userCard?.is_blocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-2xl">🔒</div>
          </div>
        )}

        {/* Trade ready ribbon */}
        {userCard?.is_trade_ready && (
          <div className="absolute right-0 top-7 -translate-y-1/2 rounded-l bg-teal-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            TRADE
          </div>
        )}

        {/* Animated marker */}
        {card.is_animated && (
          <div className="absolute right-1.5 bottom-12 rounded bg-purple-500/80 px-1 text-[8px] font-bold text-white">
            ✦
          </div>
        )}

        {/* Bottom gradient + text */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-2 py-1.5">
          <div
            className={cn(
              "truncate font-bold text-white",
              size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm",
            )}
          >
            {card.character_name}
          </div>
          {card.series?.title && (
            <div
              className={cn(
                "truncate text-white/60",
                size === "sm" ? "text-[8px]" : "text-[10px]",
              )}
            >
              {card.series.title}
            </div>
          )}
        </div>
      </button>

      {showOwnerCount && (
        <div className="mt-1 text-center text-[10px] text-muted-foreground">
          {ownerCount ?? 0} owner{ownerCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

// Public order: top tier first
export const CARD_RANKS: CardRank[] = ["X", "S", "A", "B", "C", "D", "E", "F", "G"];
