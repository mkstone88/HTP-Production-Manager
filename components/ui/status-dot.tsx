import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "info" | "muted";

const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-primary",
  muted: "text-muted-foreground",
};

const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-primary",
  muted: "bg-muted-foreground/60",
};

/** Colored dot + colored label (no pill) — the app's status language. */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        TONE_TEXT[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone])} />
      {label}
    </span>
  );
}
