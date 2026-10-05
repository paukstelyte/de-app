import rules from "@/lib/flashcards/data/rules.json";
import { formatRuleText } from "@/lib/flashcards/ruleFormatting";
import { PrintButton } from "@/components/PrintButton";

interface RuleException {
  noun: string;
  article: "der" | "die" | "das";
  note: string;
}

interface Rule {
  id: string;
  article: "der" | "die" | "das";
  title: string;
  matchType: "suffix" | "semantic";
  suffixes?: string[];
  category?: string;
  description: string;
  examples: string[];
  exceptions: RuleException[];
}

const typedRules = rules as Rule[];

const ARTICLE_STYLES: Record<Rule["article"], string> = {
  der: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  die: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  das: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const ARTICLE_LABELS: Record<Rule["article"], string> = {
  der: "masculine",
  die: "feminine",
  das: "neuter",
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function bareNoun(noun: string): string {
  return noun.replace(/^(der|die|das)\s+/i, "");
}

export const metadata = {
  title: "The Rules — die·der·das",
};

export default function RulesPage() {
  const groups: Record<Rule["article"], Rule[]> = { der: [], die: [], das: [] };
  for (const rule of typedRules) groups[rule.article].push(rule);

  return (
    <>
    <div className="flex flex-col gap-10 print:hidden">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">The Rules</h1>
          <PrintButton
            label="Export rules (PDF)"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Every German noun has a grammatical gender — masculine (
            <strong>der</strong>), feminine (<strong>die</strong>), or neuter
            (<strong>das</strong>) — and it rarely tracks real-world meaning:
            <em> das Mädchen</em> (the girl) is neuter, and <em>die Person</em>{" "}
            is feminine even when it refers to a man. Ultimately, gender has
            to be memorized noun by noun. But it isn&apos;t random: roughly
            80% of nouns follow a pattern based on how they end (a{" "}
            <strong>suffix</strong> rule) or what they mean (a{" "}
            <strong>semantic</strong> rule) — enough to turn a blind guess
            into an educated one.
          </p>
          <p>
            Some suffix rules are essentially exceptionless (
            <em>-ung</em>, <em>-heit/-keit</em>, <em>-schaft</em>,{" "}
            <em>-tion/-sion</em>, <em>-tät</em>) — learn those first. Others
            are strong tendencies with well-known exceptions, which are
            listed right alongside each rule below, because the words that{" "}
            <em>look</em> like they should follow a pattern and don&apos;t are
            exactly what trips learners up.
          </p>
        </div>
      </section>

      {(["der", "die", "das"] as const).map((article) => (
        <section key={article} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold capitalize">{article}</h2>
          <div className="flex flex-col gap-4">
            {groups[article].map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </section>
      ))}
    </div>
    <PrintRules groups={groups} />
    </>
  );
}

function PrintRules({ groups }: { groups: Record<Rule["article"], Rule[]> }) {
  return (
    <div className="hidden print:block">
      {(["der", "die", "das"] as const).map((article, index) => (
        <section
          key={article}
          className={index < 2 ? "break-after-page" : undefined}
        >
          <header className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-1.5">
            <h2 className="text-base font-bold capitalize">
              {article}{" "}
              <span className="font-normal text-zinc-500">
                ({ARTICLE_LABELS[article]})
              </span>
            </h2>
            <span className="text-[9px] text-zinc-400">
              die·der·das — rules reference
            </span>
          </header>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            {groups[article].map((rule) => (
              <div key={rule.id} className="break-inside-avoid text-[7.5pt] leading-snug">
                <p className="font-semibold">{rule.title}</p>
                <p className="text-zinc-700">{truncate(rule.description, 105)}</p>
                <p className="mt-0.5 text-zinc-800">
                  <span className="font-medium">Ex: </span>
                  {rule.examples.slice(0, 5).join(", ")}
                </p>
                {rule.exceptions.length > 0 && (
                  <p className="text-zinc-500">
                    <span className="font-medium">Exc: </span>
                    {rule.exceptions
                      .slice(0, 4)
                      .map((exception) => `${exception.article} ${bareNoun(exception.noun)}`)
                      .join(", ")}
                    {rule.exceptions.length > 4 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ARTICLE_STYLES[rule.article]}`}
        >
          {rule.article}
        </span>
        <h3 className="font-semibold">{rule.title}</h3>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {rule.matchType === "suffix" ? "suffix rule" : "semantic rule"}
        </span>
      </div>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {formatRuleText(rule.description)}
      </p>

      <div className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Examples
        </h4>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {rule.examples.map((example) => (
            <li
              key={example}
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {rule.article} {example}
            </li>
          ))}
        </ul>
      </div>

      {rule.exceptions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Exceptions
          </h4>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {rule.exceptions.map((exception) => (
              <li key={exception.noun} className="text-sm">
                <span className="font-medium capitalize">
                  {exception.article} {exception.noun.replace(/^(der|die|das)\s+/i, "")}
                </span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  — {formatRuleText(exception.note)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
