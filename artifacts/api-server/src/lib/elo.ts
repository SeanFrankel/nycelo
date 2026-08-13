const K_FACTOR = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute new ELO ratings.
 * scoreA: 1 = A wins, 0 = B wins, 0.5 = draw
 * weight: K-factor multiplier (experience-based vote weighting; 1 = standard)
 */
export function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  weight = 1,
): { newA: number; newB: number } {
  const expA = expectedScore(ratingA, ratingB);
  const expB = 1 - expA;
  const scoreB = 1 - scoreA;
  const k = K_FACTOR * weight;
  return {
    newA: ratingA + k * (scoreA - expA),
    newB: ratingB + k * (scoreB - expB),
  };
}
