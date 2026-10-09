import type { Level } from "@/lib/grammar/topics";

const COLORS: Record<Level, string> = {
  A1: "text-emerald-700 dark:text-emerald-400",
  A2: "text-sky-700 dark:text-sky-400",
  B1: "text-violet-700 dark:text-violet-400",
  B2: "text-orange-700 dark:text-orange-400",
  C1: "text-amber-700 dark:text-amber-300",
  C2: "text-zinc-600 dark:text-zinc-300",
};

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={`inline-flex min-w-9 justify-center border-[1.5px] border-current px-1.5 py-0.5 text-xs font-bold tabular-nums ${COLORS[level]}`}>
      {level}
    </span>
  );
}
