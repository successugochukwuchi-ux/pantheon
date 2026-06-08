import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { NoteRenderer } from './NoteRenderer';
import { F } from './Theme';

interface QuestionRendererProps {
  question: string;
  options: string[];
  selectedOptionIndex?: number | null;
  correctOptionIndex?: number | null;
  isAnswered?: boolean;
  explanation?: string | null;
  onSelectOption?: (index: number) => void;
}

function formatOptionText(text: string): string {
  if (typeof text !== 'string') return '';
  let processed = text;
  
  if (processed.startsWith('$') && processed.endsWith('$')) {
    processed = processed.substring(1, processed.length - 1).trim();
  }
  
  // Basic symbols mapping
  processed = processed.replace(/\\alpha/g, 'α');
  processed = processed.replace(/\\beta/g, 'β');
  processed = processed.replace(/\\gamma/g, 'γ');
  processed = processed.replace(/\\delta/g, 'δ');
  processed = processed.replace(/\\theta/g, 'θ');
  processed = processed.replace(/\\pi/g, 'π');
  processed = processed.replace(/\\omega/g, 'ω');
  processed = processed.replace(/\\lambda/g, 'λ');
  processed = processed.replace(/\\infty/g, '∞');
  processed = processed.replace(/\\pm/g, '±');
  processed = processed.replace(/\\times/g, '×');
  processed = processed.replace(/\\div/g, '÷');
  processed = processed.replace(/\\to/g, '→');
  processed = processed.replace(/\\rightarrow/g, '→');
  processed = processed.replace(/\\geq/g, '≥');
  processed = processed.replace(/\\leq/g, '≤');
  processed = processed.replace(/\\neq/g, '≠');
  processed = processed.replace(/\\approx/g, '≈');
  processed = processed.replace(/\\partial/g, '∂');

  // Fractions (like \frac{a}{b} -> a/b)
  processed = processed.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1/$2');

  // Square roots (like \sqrt{x} -> √$1)
  processed = processed.replace(/\\sqrt\s*\{([^}]+)\}/g, '√$1');

  // Basic superscripts and subscripts parsing
  processed = processed.replace(/\^2/g, '²');
  processed = processed.replace(/\^3/g, '³');
  processed = processed.replace(/\^x/g, 'ˣ');
  processed = processed.replace(/\^y/g, 'ʸ');
  processed = processed.replace(/\^n/g, 'ⁿ');
  processed = processed.replace(/\^{-1}/g, '⁻¹');
  processed = processed.replace(/\^1/g, '¹');
  processed = processed.replace(/\^4/g, '⁴');
  
  processed = processed.replace(/_2/g, '₂');
  processed = processed.replace(/_3/g, '₃');
  processed = processed.replace(/_x/g, 'ₓ');
  processed = processed.replace(/_n/g, 'ₙ');
  processed = processed.replace(/_1/g, '₁');
  processed = processed.replace(/_0/g, '₀');

  // Remove matching braces
  processed = processed.replace(/\{/g, '').replace(/\}/g, '');

  return processed;
}

export function QuestionRenderer({
  question,
  options = [],
  selectedOptionIndex = null,
  correctOptionIndex = null,
  isAnswered = false,
  explanation = null,
  onSelectOption,
}: QuestionRendererProps) {
  const { colors: C } = useTheme();

  return (
    <View style={s.container}>
      {/* Question Content inside standard NoteRenderer with touch events disabled */}
      <View style={s.questionWrap} pointerEvents="none">
        <NoteRenderer content={question} />
      </View>

      {/* MCQ Options with native TouchableOpacity list */}
      <View style={s.optionsWrap}>
        {options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const isSelected = selectedOptionIndex === i;
          const isCorrect = correctOptionIndex === i;

          let cardStyle = [s.optCard, { borderColor: C.border, backgroundColor: C.surface }] as any;
          let letterContainer = [s.optLetterCirc, { backgroundColor: C.surfaceDark || C.border }] as any;
          let letterText = [s.optLetterText, { color: C.inkMid }] as any;
          let optText = [s.optText, { color: C.ink }] as any;

          if (isSelected && !isAnswered) {
            // Selected option in practice mode (not yet submitted/answered)
            cardStyle.push({ borderColor: C.ink, backgroundColor: C.surfaceDark || C.border });
            letterContainer.push({ backgroundColor: C.ink });
            letterText.push({ color: C.bg });
          }

          if (isAnswered) {
            if (isCorrect) {
              // Correct option (green)
              cardStyle.push({ borderColor: '#2E7D32', backgroundColor: '#E8F5E9' });
              letterContainer.push({ backgroundColor: '#4CAF50' });
              letterText.push({ color: '#fff' });
              optText.push({ color: '#1B5E20', fontFamily: F.medium });
            } else if (isSelected) {
              // Incorrectly selected option (red)
              cardStyle.push({ borderColor: '#C62828', backgroundColor: '#FFEBEE' });
              letterContainer.push({ backgroundColor: '#F44336' });
              letterText.push({ color: '#fff' });
              optText.push({ color: '#C62828', fontFamily: F.medium });
            }
          }

          return (
            <TouchableOpacity
              key={i}
              style={cardStyle}
              activeOpacity={0.8}
              disabled={isAnswered || !onSelectOption}
              onPress={() => onSelectOption && onSelectOption(i)}
            >
              <View style={letterContainer}>
                <Text style={letterText}>{letter}</Text>
              </View>

              <View style={{ flex: 1, paddingVertical: 2 }}>
                <Text style={optText}>{formatOptionText(opt)}</Text>
              </View>

              {isAnswered && isCorrect && (
                <Text style={s.correctIndicatorText}>✓ Correct</Text>
              )}
              {isAnswered && isSelected && !isCorrect && (
                <Text style={s.wrongIndicatorText}>Your Answer</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation Display block with rich NoteRenderer */}
      {isAnswered && explanation && (
        <View style={[s.explanationCard, { backgroundColor: C.surface, borderColor: C.border }]} pointerEvents="none">
          <Text style={[s.explanationTitle, { color: C.ink }]}>EXPLANATION</Text>
          <NoteRenderer content={explanation} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
  },
  questionWrap: {
    marginBottom: 8,
  },
  optionsWrap: {
    gap: 10,
    marginTop: 8,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optLetterCirc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optLetterText: {
    fontFamily: F.bold,
    fontSize: 13,
  },
  optText: {
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 20,
  },
  correctIndicatorText: {
    fontFamily: F.bold,
    fontSize: 11,
    color: '#2E7D32',
    marginLeft: 8,
  },
  wrongIndicatorText: {
    fontFamily: F.bold,
    fontSize: 11,
    color: '#C62828',
    marginLeft: 8,
  },
  explanationCard: {
    marginTop: 18,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  explanationTitle: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
});
