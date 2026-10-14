import { useReducer } from "react";
import type { Article, Flashcard } from "./types";
import { shuffle } from "@/lib/exercises/check";
import type { Score } from "@/lib/progress";
import { buildPracticeOrder, ROUND_SIZE } from "./practice";

const EMPTY_SCORE: Score = { correct: 0, total: 0 };

interface SessionState {
  // The card ids of the current deck, shuffled once when the deck starts (null until the deck has loaded).
  baseQueue: string[] | null;
  recapQueue: string[] | null;
  wrongThisPass: string[];
  isRecap: boolean;
  index: number;
  chosen: Article | null;
  // Score for the current deck only — resets every new deck. Recap answers
  // don't count toward it, since a recap isn't itself "a deck of 30".
  deckScore: Score;
  // Session-wide stats shown at the bottom of the page — persist across
  // decks and are only reset by the Restart button.
  decksPlayed: number;
  mistakesLearned: number;
  // Accuracy tracked from base-round answers only, excluding "learn from
  // your mistakes" recap passes.
  baseStats: Score;
}

const initialState: SessionState = {
  baseQueue: null,
  recapQueue: null,
  wrongThisPass: [],
  isRecap: false,
  index: 0,
  chosen: null,
  deckScore: EMPTY_SCORE,
  decksPlayed: 0,
  mistakesLearned: 0,
  baseStats: EMPTY_SCORE,
};

type Action =
  | { type: "start_fresh_deck"; queue: string[] }
  | { type: "restart"; queue: string[] }
  | { type: "start_recap" }
  | { type: "choose"; article: Article; wasCorrect: boolean; cardId: string; countsTowardStats: boolean }
  | { type: "advance"; crossedDeckBoundary: boolean };

function addAnswer(score: Score, wasCorrect: boolean): Score {
  return {
    correct: score.correct + (wasCorrect ? 1 : 0),
    total: score.total + 1,
  };
}

function sessionReducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "start_fresh_deck":
      return {
        ...state,
        baseQueue: action.queue,
        recapQueue: null,
        wrongThisPass: [],
        isRecap: false,
        index: 0,
        chosen: null,
        deckScore: EMPTY_SCORE,
      };
    case "restart":
      return { ...initialState, baseQueue: action.queue };
    case "start_recap":
      return {
        ...state,
        recapQueue: state.wrongThisPass,
        wrongThisPass: [],
        isRecap: true,
        index: 0,
        chosen: null,
      };
    case "choose": {
      if (state.chosen) return state;
      const { article, wasCorrect, cardId, countsTowardStats } = action;
      return {
        ...state,
        chosen: article,
        mistakesLearned:
          state.isRecap && wasCorrect
            ? state.mistakesLearned + 1
            : state.mistakesLearned,
        deckScore: state.isRecap
          ? state.deckScore
          : addAnswer(state.deckScore, wasCorrect),
        baseStats:
          state.isRecap || !countsTowardStats
            ? state.baseStats
            : addAnswer(state.baseStats, wasCorrect),
        wrongThisPass: wasCorrect
          ? state.wrongThisPass
          : [...state.wrongThisPass, cardId],
      };
    }
    case "advance":
      return {
        ...state,
        index: state.index + 1,
        chosen: null,
        decksPlayed: action.crossedDeckBoundary
          ? state.decksPlayed + 1
          : state.decksPlayed,
      };
  }
}

/** Owns the practice-round state machine (deck building, recap, scoring,
 * session stats) so the page component only has to render it. A deck's order is
 * shuffled once, when the deck starts, and kept in state; answering never reshuffles it.
 * Mount it once the cards are available (the first deck is built on mount). */
export function usePracticeSession(
  cards: Flashcard[],
  recordAnswer: (id: string, article: Article, wasCorrect: boolean) => void,
  /** Logged-in only: the user's saved trouble words. */
  troubleIds?: string[],
  /** "Practise my mistakes": rounds are built from `troubleIds` only. */
  mistakesOnly = false,
) {
  // troubleIds is most-missed first, so a big list practises the worst words.
  const buildQueue = (pool: Flashcard[]) =>
    mistakesOnly ? shuffle((troubleIds ?? []).slice(0, ROUND_SIZE)) : buildPracticeOrder(pool, troubleIds);
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => ({
    ...initialState,
    baseQueue: cards.length > 0 ? buildQueue(cards) : null,
  }));
  // An optional recap queue (the cards missed last round) overrides the base
  // round until it's cleared by starting a fresh round.
  const queue = state.recapQueue ?? state.baseQueue;

  function choose(article: Article, cardId: string, correctArticle: Article) {
    if (state.chosen) return;
    const wasCorrect = article === correctArticle;
    recordAnswer(cardId, article, wasCorrect);
    // "Practise my mistakes" rounds are short and hand-picked, so they stay out
    // of the session-wide Decks played / Overall accuracy.
    dispatch({ type: "choose", article, wasCorrect, cardId, countsTowardStats: !mistakesOnly });
  }

  function advance() {
    const crossedDeckBoundary =
      !!queue && state.index + 1 >= queue.length && !state.isRecap && !mistakesOnly;
    dispatch({ type: "advance", crossedDeckBoundary });
  }

  return {
    queue,
    effectiveIndex: state.index,
    chosen: state.chosen,
    isRecap: state.isRecap,
    deckScore: state.deckScore,
    decksPlayed: state.decksPlayed,
    mistakesLearned: state.mistakesLearned,
    baseStats: state.baseStats,
    wrongThisPass: state.wrongThisPass,
    choose,
    advance,
    /** "Next N words" — starts a fresh deck (from `pool`, e.g. a newly chosen level), session-wide stats keep counting. */
    nextRound: (pool: Flashcard[] = cards) => dispatch({ type: "start_fresh_deck", queue: buildQueue(pool) }),
    /** The Restart button — starts a fresh deck AND resets the session-wide
     * stats shown at the bottom of the page. */
    restart: () => dispatch({ type: "restart", queue: buildQueue(cards) }),
    startRecap: () => dispatch({ type: "start_recap" }),
  };
}
