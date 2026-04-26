import { cn } from "@/lib/utils";

export type TranslationStatus = "new" | "translated" | "pending" | "none" | "processing";

const styles: Record<TranslationStatus, string> = {
  new: "bg-status-new/15 text-status-new ring-1 ring-status-new/30",
  translated: "bg-status-translated/15 text-status-translated ring-1 ring-status-translated/30",
  pending: "bg-status-pending/15 text-status-pending ring-1 ring-status-pending/30",
  processing: "bg-status-pending/15 text-status-pending ring-1 ring-status-pending/30",
  none: "bg-status-none/15 text-status-none ring-1 ring-status-none/30",
};

const labels: Record<TranslationStatus, string> = {
  new: "New",
  translated: "Translated",
  pending: "Pending",
  processing: "Translating",
  none: "Not translated",
};

interface Props {
  status: TranslationStatus;
  className?: string;
  label?: string;
}

export function StatusBadge({ status, className, label }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        styles[status],
        className,
      )}
    >
      {label ?? labels[status]}
    </span>
  );
}
