import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { NoteRenderer } from './NoteRenderer';
import {
  formatLatexFormula,
  autoWrapLatexMath,
  parseMathSegments,
  renderTextWithScripts,
} from './MathText';
import { F } from './Theme';

export { formatLatexFormula as formatLatexMath, autoWrapLatexMath };

/**
 * Extracts clean human-readable text & LaTeX from structured note JSON or <PLX> blocks
 * so context prompts and previews never leak raw JSON arrays.
 */
export function extractReadableQuestionText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((block: any) => {
            if (!block) return '';
            if (typeof block === 'string') return block;
            if (typeof block.content === 'string') return block.content;
            if (typeof block.text === 'string') return block.text;
            if (Array.isArray(block.items)) return block.items.join('\n');
            if (Array.isArray(block.rows)) {
              return block.rows.map((r: any) => (Array.isArray(r) ? r.join(' | ') : String(r))).join('\n');
            }
            return '';
          })
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      // Not valid JSON, continue as normal string
    }
  }

  if (trimmed.includes('<PLX>') || trimmed.includes('</PLX>')) {
    return trimmed
      .replace(/<\/?PLX>/g, '')
      .replace(/![A-Z]+\[/g, '')
      .replace(/\]/g, ' ')
      .trim();
  }

  return trimmed;
}

export function HermesMessageContent({ content, C }: { content: string; C: any }) {
  const isStructuredNote = useMemo(() => {
    if (!content) return false;
    if (content.includes('<PLX>') || content.includes('</PLX>')) return true;
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  }, [content]);

  const { lines, displayMathBlocks } = useMemo(() => {
    if (!content) return { lines: [] as string[], displayMathBlocks: [] as string[] };

    let s = String(content).replace(/\r\n/g, '\n');

    // Normalize JSON double-escaped backslashes before LaTeX commands (e.g. \\frac -> \frac, \\sqrt -> \sqrt)
    s = s.replace(/\\\\([a-zA-Z]{2,}|[\(\[\)\]])/g, '\\$1');

    const blocks: string[] = [];
    const addDisplayBlock = (formula: string) => {
      const id = blocks.length;
      blocks.push(formula.trim());
      return `\n@@HERMES_DISPLAY_MATH_${id}@@\n`;
    };

    // 1. Extract \[ ... \] display math blocks (single-line or multi-line)
    s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => addDisplayBlock(inner));

    // 2. Extract $$ ... $$ display math blocks
    s = s.replace(/\$\$([\s\S]*?)\$\$/g, (full, inner, offset, fullStr) => {
      const isMultiLine = inner.includes('\n');
      // Check if it sits alone on its line or has substantial math
      const lineStart = fullStr.lastIndexOf('\n', offset - 1) + 1;
      const lineEndIdx = fullStr.indexOf('\n', offset + full.length);
      const lineEnd = lineEndIdx === -1 ? fullStr.length : lineEndIdx;
      const beforeOnLine = fullStr.slice(lineStart, offset).trim();
      const afterOnLine = fullStr.slice(offset + full.length, lineEnd).trim();

      if (isMultiLine || (!beforeOnLine && !afterOnLine) || (!afterOnLine && inner.trim().length > 12)) {
        return addDisplayBlock(inner);
      }
      // Inline $$...$$ inside a sentence -> normalize to single-line $...$
      return `$${inner.replace(/\s*\n\s*/g, ' ').trim()}$`;
    });

    // 3. Extract naked multi-line LaTeX environments (\begin{aligned}...\end{aligned}, \begin{cases}...\end{cases}, etc.)
    s = s.replace(
      /\\begin\{(aligned|align\*?|eqnarray\*?|gather\*?|multline\*?|split|equation\*?|cases|dcases|rcases|(?:p|b|B|v|V|small)?matrix|array)\}[\s\S]*?\\end\{\1\}/g,
      match => addDisplayBlock(match)
    );

    // 4. Normalize multi-line inline \( ... \) into single-line $ ... $
    s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.replace(/\s*\n\s*/g, ' ').trim()}$`);

    // 5. Run autoWrapLatexMath so naked \frac{...}{...}, \sqrt{...}, etc. are properly delimited
    s = autoWrapLatexMath(s);

    // Collapse 3+ consecutive newlines into 2
    s = s.replace(/\n{3,}/g, '\n\n');

    return {
      lines: s.split('\n'),
      displayMathBlocks: blocks,
    };
  }, [content]);

  if (isStructuredNote) {
    return (
      <NoteRenderer
        content={content}
        bgOverride={C.surface}
        paddingOverride="14px 18px"
        inkOverride={C.ink}
      />
    );
  }

  /**
   * Renders a text chunk (which may contain inline $...$ math or bare LaTeX)
   * using MathText's recursive parser and script renderer.
   */
  const renderMathAwareChunk = (
    chunkText: string,
    keyPrefix: string,
    baseFontSize: number,
    isBoldContext: boolean,
    isItalicContext: boolean
  ) => {
    const segments = parseMathSegments(chunkText);
    return segments.map((seg, sIdx) => {
      if (!seg.text) return null;
      const segKey = `${keyPrefix}-seg-${sIdx}`;
      if (seg.isMath) {
        return (
          <Text
            key={segKey}
            style={{
              fontFamily: F.bold,
              fontStyle: isItalicContext ? 'italic' : 'normal',
              color: C.activeText || C.ink,
              fontSize: baseFontSize,
              letterSpacing: 0.3,
            }}
          >
            {renderTextWithScripts(seg.text, segKey, baseFontSize)}
          </Text>
        );
      }
      return (
        <Text
          key={segKey}
          style={{
            fontFamily: isBoldContext ? F.bold : F.body,
            fontStyle: isItalicContext ? 'italic' : 'normal',
            color: C.ink,
          }}
        >
          {renderTextWithScripts(seg.text, segKey, baseFontSize)}
        </Text>
      );
    });
  };

  /**
   * Renders inline markdown (**bold**, *italic*, `code`) AND inline LaTeX math ($...$).
   * Protects math and code spans BEFORE splitting markdown so that:
   * 1) '*' inside math formulas ($2 * x$) never breaks math delimiters
   * 2) Math inside bold (**Step 1: Find $\frac{dy}{dx}$**) is fully parsed and rendered
   */
  const renderFormattedText = (text: string, keyPrefix: string, textStyle: any) => {
    const baseFontSize = textStyle?.fontSize || 14.5;
    const isHeadingBold = textStyle?.fontFamily === F.bold;

    // Step 1: Temporarily protect inline code (`...`) and inline math ($...$, $$...$$, \(...\), \[...\])
    const mathTokens: string[] = [];
    const codeTokens: string[] = [];

    let tokenized = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const id = codeTokens.length;
      codeTokens.push(code);
      return `@@HRM_CODE_${id}@@`;
    });

    tokenized = tokenized.replace(
      /(\$\$[^\$\n]+?\$\$|\$[^\$\n]+?\$|\\\[[^\n]+?\\\]|\\\([^\n]+?\\\))/g,
      match => {
        const id = mathTokens.length;
        mathTokens.push(match);
        return `@@HRM_MATH_${id}@@`;
      }
    );

    const restoreMathTokens = (str: string): string =>
      str.replace(/@@HRM_MATH_(\d+)@@/g, (_, id) => mathTokens[Number(id)] || '');

    // Step 2: Split by code tokens, **bold**, and *italic*
    const parts = tokenized.split(/(@@HRM_CODE_\d+@@|\*\*[\s\S]+?\*\*|\*[^*\n]+?\*)/g);

    return (
      <Text key={keyPrefix} style={textStyle}>
        {parts.map((part, idx) => {
          if (!part) return null;
          const partKey = `${keyPrefix}-${idx}`;

          const codeMatch = part.match(/^@@HRM_CODE_(\d+)@@$/);
          if (codeMatch) {
            const rawCode = codeTokens[Number(codeMatch[1])] || '';
            // If the LLM wrapped a LaTeX expression inside backticks (e.g. `\frac{a}{b}`), format it as math
            const looksLikeLatex = /\\(?:frac|dfrac|tfrac|sqrt|alpha|beta|gamma|delta|theta|lambda|pi|sigma|omega|int|sum|prod|lim|pm|times|div|cdot|leq|geq|neq|approx|equiv|rightarrow|to|implies|iff|in|subset|cup|cap)\b|\^\{|_\{/.test(
              rawCode
            );
            if (looksLikeLatex) {
              const formattedCodeMath = formatLatexFormula(rawCode);
              return (
                <Text
                  key={partKey}
                  style={{
                    fontFamily: F.bold,
                    backgroundColor: C.tabBg,
                    color: C.activeText || C.ink,
                    paddingHorizontal: 4,
                    borderRadius: 4,
                    fontSize: baseFontSize,
                  }}
                >
                  {renderTextWithScripts(formattedCodeMath, partKey, baseFontSize)}
                </Text>
              );
            }
            return (
              <Text
                key={partKey}
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: C.tabBg,
                  color: C.activeText || C.ink,
                  paddingHorizontal: 4,
                  borderRadius: 3,
                  fontSize: Math.max(12, baseFontSize - 1),
                }}
              >
                {rawCode}
              </Text>
            );
          }

          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            const innerBold = restoreMathTokens(part.slice(2, -2));
            return (
              <Text key={partKey} style={{ fontFamily: F.bold, color: C.ink }}>
                {renderMathAwareChunk(innerBold, partKey, baseFontSize, true, false)}
              </Text>
            );
          }

          if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
            const innerItalic = restoreMathTokens(part.slice(1, -1));
            return (
              <Text key={partKey} style={{ fontStyle: 'italic', color: C.ink }}>
                {renderMathAwareChunk(innerItalic, partKey, baseFontSize, isHeadingBold, true)}
              </Text>
            );
          }

          const restoredPlain = restoreMathTokens(part);
          return renderMathAwareChunk(restoredPlain, partKey, baseFontSize, isHeadingBold, false);
        })}
      </Text>
    );
  };

  const renderDisplayMathCard = (rawFormula: string, key: string | number) => {
    const formattedFormula = formatLatexFormula(rawFormula);
    if (!formattedFormula) return null;
    return (
      <View
        key={key}
        style={{
          marginVertical: 8,
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: C.activeBg || C.tabBg,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.border,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: F.bold,
            fontSize: 15.5,
            color: C.activeText || C.ink,
            letterSpacing: 0.4,
            textAlign: 'center',
            lineHeight: 24,
          }}
        >
          {renderTextWithScripts(formattedFormula, `disp-${key}`, 15.5)}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 10 }}>
      {lines.map((line: string, lineIdx: number) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={lineIdx} style={{ height: 6 }} />;
        }

        // 1. Extracted multi-line / standalone Display Math block
        const displayBlockMatch = trimmed.match(/^@@HERMES_DISPLAY_MATH_(\d+)@@$/);
        if (displayBlockMatch) {
          const blockFormula = displayMathBlocks[Number(displayBlockMatch[1])] || '';
          return renderDisplayMathCard(blockFormula, `dmath-${lineIdx}`);
        }

        // 2. Horizontal rule (---, ***, ___)
        if (/^([-*_])\1{2,}$/.test(trimmed)) {
          return (
            <View
              key={lineIdx}
              style={{
                height: 1,
                backgroundColor: C.border,
                marginVertical: 8,
              }}
            />
          );
        }

        // 3. Markdown Headings (#, ##, ###, ####) with full math and inline formatting support
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];
          const fontSize = level === 1 ? 16.5 : level === 2 ? 15.5 : 14.5;
          return (
            <View key={lineIdx} style={{ marginBottom: 5, marginTop: level <= 2 ? 6 : 3 }}>
              {renderFormattedText(headingText, `h-${lineIdx}`, {
                fontFamily: F.bold,
                fontSize,
                lineHeight: fontSize + 7,
                color: C.ink,
              })}
            </View>
          );
        }

        // 4. Single-line standalone Display Math ($...$ or $$...$$)
        const isStandaloneSingleLineMath =
          /^\s*(\$\$|\\\[)\s*([\s\S]+?)\s*(\$\$|\\\])\s*$/.test(trimmed) ||
          (/^\s*\$\s*([^$]+?)\s*\$\s*$/.test(trimmed) &&
            (trimmed.includes('\\') ||
              trimmed.includes('=') ||
              trimmed.includes('^') ||
              trimmed.includes('_') ||
              trimmed.includes('frac') ||
              trimmed.includes('sqrt')));

        if (isStandaloneSingleLineMath) {
          return renderDisplayMathCard(trimmed, `smath-${lineIdx}`);
        }

        // 5. Blockquotes (> ...)
        if (trimmed.startsWith('> ')) {
          return (
            <View
              key={lineIdx}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: C.activeText || C.ink,
                paddingLeft: 10,
                paddingVertical: 2,
                marginVertical: 4,
              }}
            >
              {renderFormattedText(trimmed.slice(2), `quote-${lineIdx}`, {
                fontFamily: F.body,
                fontSize: 14.5,
                lineHeight: 22,
                color: C.inkMid || C.ink,
              })}
            </View>
          );
        }

        // 6. Bullet lists (- , * , • ) including indented bullets
        const bulletMatch = line.match(/^(\s*)(?:[-*•])\s+(.*)/);
        if (bulletMatch) {
          const indentSpaces = bulletMatch[1].length;
          const bulletContent = bulletMatch[2];
          return (
            <View
              key={lineIdx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 4,
                paddingLeft: 4 + Math.min(indentSpaces * 4, 24),
              }}
            >
              <Text
                style={{
                  color: C.activeText || C.ink,
                  fontSize: 15,
                  marginRight: 6,
                  lineHeight: 22,
                }}
              >
                •
              </Text>
              <View style={{ flex: 1 }}>
                {renderFormattedText(bulletContent, `bullet-${lineIdx}`, {
                  fontFamily: F.body,
                  fontSize: 14.5,
                  lineHeight: 22,
                  color: C.ink,
                })}
              </View>
            </View>
          );
        }

        // 7. Numbered lists (1. , 1) , **1.** )
        const numMatch = trimmed.match(/^(?:\*\*(\d+)[.)]\*\*|(\d+)[.)])\s+(.*)/);
        if (numMatch) {
          const numLabel = numMatch[1] || numMatch[2];
          const numContent = numMatch[3];
          return (
            <View
              key={lineIdx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 4,
                paddingLeft: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: F.bold,
                  color: C.inkMid || C.ink,
                  fontSize: 14,
                  marginRight: 6,
                  lineHeight: 22,
                }}
              >
                {numLabel}.
              </Text>
              <View style={{ flex: 1 }}>
                {renderFormattedText(numContent, `num-${lineIdx}`, {
                  fontFamily: F.body,
                  fontSize: 14.5,
                  lineHeight: 22,
                  color: C.ink,
                })}
              </View>
            </View>
          );
        }

        // 8. Standard paragraph line
        return (
          <View key={lineIdx} style={{ marginBottom: 4 }}>
            {renderFormattedText(line, `p-${lineIdx}`, {
              fontFamily: F.body,
              fontSize: 14.5,
              lineHeight: 22,
              color: C.ink,
            })}
          </View>
        );
      })}
    </View>
  );
}
