/** Display names for game-activity copy (activity events only). */
export const GAME_LABELS: Record<string, string> = {
  WOULD_YOU_RATHER: "Would You Rather",
  TRIVIA: "Trivia",
  SLIDING_PUZZLE: "Sliding Puzzle",
  MEMORY_BLOCK_BLAST: "Memory Block Blast",
};

/**
 * Canonical answer check for quiz games. Single source for the score route so
 * correctness is never taken from the client.
 *
 * Returns null when the question type does not support scoring.
 */
export function isAnswerCorrect(
  type: string,
  answer: string | null,
  selectedAnswer: string,
): boolean | null {
  if (type === "WOULD_YOU_RATHER") {
    if (!answer || answer === "none") return true;
    return answer === selectedAnswer;
  }

  if (type === "TRIVIA") {
    if (!answer) return false;
    const expected = answer.trim().toLowerCase();
    if (expected === "none") return true;
    return expected === selectedAnswer.trim().toLowerCase();
  }

  return null;
}
