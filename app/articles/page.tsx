import { ArticlesGame } from "@/components/ArticlesGame";
import { getArticlesProgress } from "@/lib/attempts";

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  const { mode } = await searchParams;
  const progress = await getArticlesProgress();
  return (
    <ArticlesGame
      key={mode === "mistakes" ? "mistakes" : "normal"}
      loggedIn={!!progress}
      troubleIds={progress?.trouble.map((t) => t.id)}
      mistakesOnly={!!progress && mode === "mistakes"}
    />
  );
}
