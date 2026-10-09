// Static grammar exercises (lib/exercises/data/<slug>.json), 30 per topic.
// A choice/type prompt has exactly one `___` gap, with no punctuation inside it.
// An order item's `words` are the sentence tokens (punctuation attached) in
// correct order; the UI shuffles them.
export type ChoiceItem = { id: string; type: "choice"; prompt: string; options: string[]; answer: string; explanation: string };
export type TypeItem = { id: string; type: "type"; prompt: string; hint?: string; answers: string[]; explanation: string };
export type OrderItem = { id: string; type: "order"; words: string[]; answers: string[]; translation?: string; explanation: string };
export type ExerciseItem = ChoiceItem | TypeItem | OrderItem;
export type ExerciseSet = { slug: string; instructions: string; items: ExerciseItem[] };
