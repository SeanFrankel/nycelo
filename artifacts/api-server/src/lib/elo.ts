const K_FACTOR = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute new ELO ratings.
 * scoreA: 1 = A wins, 0 = B wins, 0.5 = draw
 */
export function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
): { newA: number; newB: number } {
  const expA = expectedScore(ratingA, ratingB);
  const expB = 1 - expA;
  const scoreB = 1 - scoreA;
  return {
    newA: ratingA + K_FACTOR * (scoreA - expA),
    newB: ratingB + K_FACTOR * (scoreB - expB),
  };
}
