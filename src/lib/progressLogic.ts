/**
 * Calculates the next progress value using a trickle effect.
 * Stays below 90% until explicitly finished.
 */
export const getNextTrickleProgress = (prev: number) => {
  const remaining = Math.max(0, 90 - prev);
  // Trickle speed: moves 10% of the remaining distance to 90%
  return prev + (remaining / 10) * Math.random();
};
