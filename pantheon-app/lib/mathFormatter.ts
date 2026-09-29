/**
 * High-fidelity mathematical and LaTeX formatting utility for React Native text.
 * Converts LaTeX formulas, Greek letters, sub/superscripts, fractions, and symbols
 * into clean, readable Unicode text for questions and answer options.
 */

import { formatLatexFormula, renderMathTextString, parseMathSegments } from '../components/MathText';

export { formatLatexFormula, renderMathTextString, parseMathSegments };

/**
 * Formats any question or answer option string containing inline LaTeX ($...$ or \(...\))
 * or bare LaTeX mathematical notation into clean, formatted Unicode representation.
 */
export function formatMathText(text: string): string {
  if (typeof text !== 'string') return '';
  return renderMathTextString(text);
}
