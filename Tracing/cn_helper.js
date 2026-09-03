/**
 * Utility to merge conditional CSS class names cleanly.
 */
export function cn(...inputs) {
  return inputs
    .flat(Infinity)
    .filter(Boolean)
    .join(' ');
}

export default cn;
