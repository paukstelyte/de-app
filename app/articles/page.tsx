import { ArticlesGame } from "@/components/ArticlesGame";
import { FlashcardsProvider } from "@/lib/flashcards/context";
import { getArticlesProgress } from "@/lib/attempts";

export const metadata = { title: "der · die · das" };

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  const { mode } = await searchParams;
  const progress = await getArticlesProgress();
  // The deck provider lives here, not in the root layout, so the word list
  // (seed.json + rules.json) is only downloaded by the page that plays it.
  return (
    <FlashcardsProvider>
      <ArticlesGame
        key={mode === "mistakes" ? "mistakes" : "normal"}
        loggedIn={!!progress}
        troubleIds={progress?.trouble.map((t) => t.id)}
        mistakesOnly={!!progress && mode === "mistakes"}
      />
    </FlashcardsProvider>
  );
}
