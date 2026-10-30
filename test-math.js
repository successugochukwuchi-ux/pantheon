
const katex = require('katex');
const { autoCorrectLatexSyntax, autoCorrectMathExpression } = require('./src/lib/latexAutoCorrect.ts');

function renderMathToKatexHtml(text) {
  let processed = autoCorrectLatexSyntax(text);
  processed = processed.replace(/(?<!\)\([^\$\n]+?)(?<!\)\$/g, (fullMatch, mathContent) => {
    const rawMath = mathContent.trim();
    if (!rawMath) return fullMatch;
    const cleaned = autoCorrectMathExpression(rawMath);
    try {
      return katex.renderToString(cleaned, { displayMode: false, throwOnError: false });
    } catch (e) {
      return fullMatch;
    }
  });
  return processed;
}

const str = 'the area of a circle is $A = \\pi r^2$, and the roots of a quadratic equation are $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.';
console.log('INPUT:', str);
const res = renderMathToKatexHtml(str);
console.log('CONTAINS KATEX:', res.includes('katex'));
console.log('SAMPLE OUTPUT:', res.slice(0, 100));
