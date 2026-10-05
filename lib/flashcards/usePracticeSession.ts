import { useMemo, useReducer } from "react";
import type { Article, Flashcard } from "./types";
import { buildPracticeOrder, ROUND_SIZE, shuffle } from "./practice";

interface RoundScore {
  correct: number;
  total: number;
}

const EMPTY_SCORE: RoundScore = { correct: 0, total: 0 };

interface SessionState {
  round: number;
  recapQueue: string[] | null;
  wrongThisPass: string[];
  isRecap: boolean;
  index: number;
  chosen: Article | null;
  // Score for the current deck only — resets every new deck. Recap answers
  // don't count toward it, since a recap isn't itself "a deck of 30".
  deckScore: RoundScore;
  // Session-wide stats shown at the bottom of the page — persist across
  // decks and are only reset by the Restart button.
  decksPlayed: number;
  mistakesLearned: number;
  // Accuracy tracked from base-round answers only, excluding "learn from
  // your mistakes" recap passes.
  baseStats: RoundScore;
}

const initialState: SessionState = {
  round: 0,
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
  | { type: "start_fresh_deck" }
  | { type: "restart" }
  | { type: "start_recap" }
  | { type: "choose"; article: Article; wasCorrect: boolean; cardId: string; countsTowardStats: boolean }
  | { type: "advance"; crossedDeckBoundary: boolean };

function addAnswer(score: RoundScore, wasCorrect: boolean): RoundScore {
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
        round: state.round + 1,
        recapQueue: null,
        wrongThisPass: [],
        isRecap: false,
        index: 0,
        chosen: null,
        deckScore: EMPTY_SCORE,
      };
    case "restart":
      return {
        ...state,
        round: state.round + 1,
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
 * session stats) so the page component only has to render it. */
export function usePracticeSession(
  cards: Flashcard[],
  recordAnswer: (id: string, article: Article, wasCorrect: boolean) => void,
  /** Logged-in only: the user's saved trouble words. */
  troubleIds?: string[],
  /** "Practise my mistakes": rounds are built from `troubleIds` only. */
  mistakesOnly = false,
) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  // Rebuilds only when the round counter changes (explicit restart, or
  // "Next N words") or once cards first become available after localStorage
  // hydrates — not on every card mutation (e.g. answering shouldn't reshuffle
  // the current round).
  const hasCards = cards.length > 0;
  const baseOrder = useMemo(
    () => {
      if (!hasCards) return null;
      // troubleIds is most-missed first, so a big list practises the worst words.
      if (mistakesOnly) return shuffle((troubleIds ?? []).slice(0, ROUND_SIZE));
      return buildPracticeOrder(cards, troubleIds);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.round, hasCards],
  );
  // An optional recap queue (the cards missed last round) overrides the base
  // round until it's cleared by starting a fresh round.
  const queue = state.recapQueue ?? baseOrder;

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
    /** "Next N words" — starts a fresh deck, session-wide stats keep counting. */
    nextRound: () => dispatch({ type: "start_fresh_deck" }),
    /** The Restart button — starts a fresh deck AND resets the session-wide
     * stats shown at the bottom of the page. */
    restart: () => dispatch({ type: "restart" }),
    startRecap: () => dispatch({ type: "start_recap" }),
  };
}
