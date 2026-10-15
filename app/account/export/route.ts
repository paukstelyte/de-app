import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/account";

/** "Download my data": everything stored about the logged-in user, as a JSON file.
 * Reads through the user's own client, so RLS limits every table to their rows. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return new Response("Log in to download your data.", { status: 401 });

  try {
    const [answers, documents, focus, uploads] = await Promise.all([
      readAllPages((from, to) => supabase.from("attempts").select("topic, item_id, answer, correct, created_at").order("id").range(from, to)),
      readAllPages((from, to) =>
        supabase
          .from("learning_documents")
          .select("title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd")
          .order("id")
          .range(from, to),
      ),
      readAllPages((from, to) => supabase.from("learning_focus").select("topic_slug, kind, updated_at").order("topic_slug").range(from, to)),
      readAllPages((from, to) => supabase.from("learning_upload_usage").select("created_at").order("id").range(from, to)),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        signInMethods: user.identities?.map((i) => i.provider) ?? [],
        googleProfile: user.user_metadata?.full_name || user.user_metadata?.avatar_url
          ? { name: user.user_metadata.full_name, picture: user.user_metadata.avatar_url }
          : undefined,
      },
      answers,
      customizedLearning: { documents, focus, uploads },
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="de-app-my-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export failed:", e instanceof Error ? e.message : "unknown");
    return new Response("Your data couldn't be loaded. Please try again.", { status: 500 });
  }
}
