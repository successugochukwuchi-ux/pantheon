import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Type, 
  Sigma, 
  Heading1, 
  Heading2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Image as ImageIcon,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Eye,
  Edit3,
  Search,
  FlaskConical,
  Zap,
  Variable,
  Table as TableIcon,
  Video,
  Wand2,
  Loader2,
  FileText,
  Upload,
  Download,
  List,
  ListOrdered,
  Settings2,
  PenTool,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { MathJax } from 'better-react-mathjax';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { Rnd } from 'react-rnd';
import { cn } from '../lib/utils';
import { SafeMathRenderer, prepareMarkdownMath } from './SafeMathRenderer';
import { magicNoteCreator } from '../services/aiService';
import { VideoPlayer } from './VideoPlayer';
import { toast } from 'sonner';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AIConfig } from '../types';

export type BlockType = 'text' | 'math' | 'h1' | 'h2' | 'diagram' | 'table' | 'video' | 'bullet-list' | 'numbered-list' | 'question';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  settings?: {
    width?: number;
    height?: number;
    flipX?: boolean;
    flipY?: boolean;
    aspectRatio?: boolean;
    questionId?: string;
  };
}

const MATH_SYMBOLS: Record<string, { icon: any; symbols: (string | { label: string; value: string })[] }> = {
  Mathematics: {
    icon: <Sigma className="h-4 w-4" />,
    symbols: [
      { label: 'Fraction', value: '\\frac{a}{b}' },
      { label: 'Root', value: '\\sqrt{x}' },
      { label: 'n-th Root', value: '\\sqrt[n]{x}' },
      { label: 'Power', value: 'x^{n}' },
      { label: 'Subscript', value: 'x_{n}' },
      { label: 'Integral', value: '\\int_{a}^{b} f(x) dx' },
      { label: 'Sum', value: '\\sum_{i=1}^{n}' },
      { label: 'Product', value: '\\prod_{i=1}^{n}' },
      { label: 'Limit', value: '\\lim_{x \\to \\infty}' },
      { label: 'Matrix 2x2', value: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: 'Matrix 3x3', value: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}' },
      { label: 'Derivative', value: '\\frac{dy}{dx}' },
      { label: 'Partial', value: '\\frac{\\partial y}{\\partial x}' },
      { label: 'Combination', value: '\\binom{n}{k}' },
      '\\pm', '\\mp', '\\neq', '\\leq', '\\geq', '\\infty', '\\log', '\\ln', '\\exp',
      '\\sin', '\\cos', '\\tan', '\\arcsin', '\\arccos', '\\arctan',
      '\\sinh', '\\cosh', '\\tanh', '\\pi', '\\theta', '\\alpha', '\\beta', 
      '\\gamma', '\\delta', '\\lambda', '\\mu', '\\sigma', '\\phi', '\\omega',
      '\\Delta', '\\Omega', '\\Gamma', '\\Phi', '\\Psi', '\\epsilon', '\\zeta',
      '\\cup', '\\cap', '\\in', '\\notin', '\\subset', '\\subseteq', '\\emptyset',
      '\\forall', '\\exists', '\\neg', '\\lor', '\\land', '\\Rightarrow', '\\Leftrightarrow',
      '\\therefore', '\\because', { label: 'Degree', value: '^\\circ' }, '\\angle', '\\bot', '\\parallel', '\\sim', '\\approx',
      '\\vec{x}', '\\bar{x}', '\\hat{x}', '\\tilde{x}', '\\dot{x}', '\\ddot{x}',
      '\\mathbb{R}', '\\mathbb{N}', '\\mathbb{Z}', '\\mathbb{Q}', '\\mathbb{C}'
    ]
  },
  Physics: {
    icon: <Zap className="h-4 w-4" />,
    symbols: [
      { label: 'Velocity', value: '\\vec{v}' },
      { label: 'Acceleration', value: '\\vec{a}' },
      { label: 'Force', value: '\\vec{F} = m\\vec{a}' },
      { label: 'Momentum', value: '\\vec{p} = m\\vec{v}' },
      { label: 'Kinetic Energy', value: 'E_k = \\frac{1}{2}mv^2' },
      { label: 'Potential Energy', value: 'E_p = mgh' },
      { label: 'Angular Momentum', value: '\\vec{L} = \\vec{r} \\times \\vec{p}' },
      { label: 'Torque', value: '\\vec{\\tau} = \\vec{r} \\times \\vec{F}' },
      { label: 'Work', value: 'W = \\vec{F} \\cdot \\vec{d}' },
      { label: 'Power', value: 'P = \\frac{W}{t}' },
      { label: 'Gravity', value: 'F_g = G\\frac{m_1 m_2}{r^2}' },
      { label: 'Pressure', value: 'P = \\frac{F}{A}' },
      { label: 'Density', value: '\\rho = \\frac{m}{V}' },
      { label: 'Ohm Law', value: 'V = IR' },
      { label: 'Power (Elec)', value: 'P = VI = I^2R = \\frac{V^2}{R}' },
      { label: 'Capacitance', value: 'C = \\frac{Q}{V}' },
      { label: 'Magnetic Flux', value: '\\Phi_B = \\vec{B} \\cdot \\vec{A}' },
      { label: 'Lorentz Force', value: '\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})' },
      { label: 'Maxwell 1', value: '\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0}' },
      { label: 'Maxwell 2', value: '\\nabla \\cdot \\vec{B} = 0' },
      { label: 'Einstein', value: 'E = mc^2' },
      { label: 'Planck', value: 'E = hf' },
      { label: 'De Broglie', value: '\\lambda = \\frac{h}{p}' },
      { label: 'Heisenberg', value: '\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}' },
      { label: 'Schrodinger', value: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi' },
      '\\hbar', '\\lambda', '\\nu', '\\rho', '\\tau', '\\psi', '\\Psi', '\\epsilon_0', '\\mu_0', 'c', 'G', 'h', 'k_B', '\\sigma_{SB}', '\\nabla', '\\nabla \\cdot', '\\nabla \\times'
    ]
  },
  Chemistry: {
    icon: <FlaskConical className="h-4 w-4" />,
    symbols: [
      { label: 'Chemical Equation', value: '\\ce{H2 + O2 -> H2O}' },
      { label: 'Equilibrium', value: '\\ce{A <=> B}' },
      { label: 'Precipitate', value: '\\ce{AgCl v}' },
      { label: 'Gas Evolution', value: '\\ce{CO2 ^}' },
      { label: 'Heat Reaction', value: '\\ce{->[\\Delta]}' },
      { label: 'Ion', value: '\\ce{SO4^2-}' },
      { label: 'Complex', value: '\\ce{[Co(NH3)6]Cl3}' },
      { label: 'Isotope', value: '\\ce{^{14}_{6}C}' },
      { label: 'Reaction Arrow', value: '\\ce{->[catalyst][heat]}' },
      { label: 'Benzene', value: '\\ce{C6H6}' },
      { label: 'Water', value: '\\ce{H2O}' },
      { label: 'Sulfuric Acid', value: '\\ce{H2SO4}' },
      { label: 'Glucose', value: '\\ce{C6H12O6}' },
      { label: 'Molarity', value: 'c = \\frac{n}{V}' },
      { label: 'Ideal Gas', value: 'PV = nRT' },
      { label: 'pH', value: '\\text{pH} = -\\log[H^+]' },
      { label: 'Gibbs Free Energy', value: '\\Delta G = \\Delta H - T\\Delta S' },
      '\\ce{H2O}', '\\ce{O2}', '\\ce{CO2}', '\\ce{CH4}', '\\ce{NH3}', '\\ce{NaCl}', '\\ce{HCl}', '\\ce{NaOH}', '\\ce{H2SO4}', '\\ce{HNO3}', '\\ce{KMnO4}', '\\ce{Fe^3+}', '\\ce{OH-}', '\\ce{PO4^3-}', '\\ce{NO3-}'
    ]
  }
};

const LANGUAGE_SYMBOLS: Record<string, { icon: any; symbols: (string | { label: string; value: string })[] }> = {
  "Igbo (Ọnwụ)": {
    icon: <PenTool className="h-4 w-4" />,
    symbols: [
      { label: 'ọ', value: 'ọ' },
      { label: 'ụ', value: 'ụ' },
      { label: 'ị', value: 'ị' },
      { label: 'ṅ', value: 'ṅ' },
      { label: 'ñ', value: 'ñ' },
      { label: 'Ọ', value: 'Ọ' },
      { label: 'Ụ', value: 'Ụ' },
      { label: 'Ị', value: 'Ị' },
      { label: 'Ṅ', value: 'Ṅ' },
      { label: 'Ñ', value: 'Ñ' },
      { label: 'á', value: 'á' },
      { label: 'é', value: 'é' },
      { label: 'í', value: 'í' },
      { label: 'ó', value: 'ó' },
      { label: 'ú', value: 'ú' },
      { label: 'ọ́', value: 'ọ́' },
      { label: 'ụ́', value: 'ụ́' },
      { label: 'ị́', value: 'ị́' },
      { label: 'à', value: 'à' },
      { label: 'è', value: 'è' },
      { label: 'ì', value: 'ì' },
      { label: 'ò', value: 'ò' },
      { label: 'ù', value: 'ù' },
      { label: 'ọ̀', value: 'ọ̀' },
      { label: 'ụ̀', value: 'ụ̀' },
      { label: 'ị̀', value: 'ị̀' },
      { label: 'm̄', value: 'm̄' },
      { label: 'n̄', value: 'n̄' },
      { label: 'ḿ', value: 'ḿ' },
      { label: 'ń', value: 'ń' },
    ]
  },
  "French (Français)": {
    icon: <FileText className="h-4 w-4" />,
    symbols: [
      { label: 'é', value: 'é' },
      { label: 'è', value: 'è' },
      { label: 'à', value: 'à' },
      { label: 'ù', value: 'ù' },
      { label: 'ç', value: 'ç' },
      { label: 'â', value: 'â' },
      { label: 'ê', value: 'ê' },
      { label: 'î', value: 'î' },
      { label: 'ô', value: 'ô' },
      { label: 'û', value: 'û' },
      { label: 'ë', value: 'ë' },
      { label: 'ï', value: 'ï' },
      { label: 'ü', value: 'ü' },
      { label: 'œ', value: 'œ' },
      { label: 'æ', value: 'æ' },
      { label: 'É', value: 'É' },
      { label: 'È', value: 'È' },
      { label: 'À', value: 'À' },
      { label: 'Ù', value: 'Ù' },
      { label: 'Ç', value: 'Ç' },
      { label: 'Â', value: 'Â' },
      { label: 'Ê', value: 'Ê' },
      { label: 'Î', value: 'Î' },
      { label: 'Ô', value: 'Ô' },
      { label: 'Û', value: 'Û' },
      { label: 'Œ', value: 'Œ' },
    ]
  },
  "Yoruba (Yorùbá)": {
    icon: <PenTool className="h-4 w-4" />,
    symbols: [
      { label: 'ẹ', value: 'ẹ' },
      { label: 'ọ', value: 'ọ' },
      { label: 'ṣ', value: 'ṣ' },
      { label: 'Ẹ', value: 'Ẹ' },
      { label: 'Ọ', value: 'Ọ' },
      { label: 'Ṣ', value: 'Ṣ' },
      { label: 'á', value: 'á' },
      { label: 'é', value: 'é' },
      { label: 'í', value: 'í' },
      { label: 'ó', value: 'ó' },
      { label: 'ú', value: 'ú' },
      { label: 'ẹ́', value: 'ẹ́' },
      { label: 'ọ́', value: 'ọ́' },
      { label: 'à', value: 'à' },
      { label: 'è', value: 'è' },
      { label: 'ì', value: 'ì' },
      { label: 'ò', value: 'ò' },
      { label: 'ù', value: 'ù' },
      { label: 'ẹ̀', value: 'ẹ̀' },
      { label: 'ọ̀', value: 'ọ̀' },
      { label: 'ā', value: 'ā' },
      { label: 'ē', value: 'ē' },
      { label: 'ī', value: 'ī' },
      { label: 'ō', value: 'ō' },
      { label: 'ū', value: 'ū' },
      { label: 'ẹ̄', value: 'ẹ̄' },
      { label: 'ọ̄', value: 'ọ̄' },
    ]
  }
};

const DEEPSEEK_PROMPT_GUIDE = `You are an expert CoLearn PLX Note Writer. Convert the user's educational material into a valid CoLearn PLX document in the structured HTML-style tag format.

[CRITICAL - PLX FORMAT SPECIFICATION]:
1. Enclose the entire file inside a root <PLX> tag.
2. Use ONLY the following supported CoLearn tag blocks:
   - <H1>Title</H1>: Main notes header.
   - <H2>Subheader</H2>: Section sub-header.
   - <TEXT>Normal body paragraph. Use <B>bolding</B> inline inside.</TEXT>
   - <B>High priority highlight/warning blocks.</B>
   - <LIST>- Bullet item 1\\n- Bullet item 2</LIST> (prefix items with dashes)
   - <ORDERED>1. Step 1\\n2. Step 2</ORDERED> (prefix items with numbers)
   - <MATH>Block level LaTeX. Do NOT use single or double dollards ($) inside this block.</MATH>
   - <TABLE>Comma-separated CSV standard rows (Header row followed by data rows).</TABLE>
   - <DIAGRAM>mermaid or text-based charts</DIAGRAM>
   - <QUES ="#">
       Multiple-choice question text
       <COR ="Correct answers option content">
       <INC ="Incorrect option choice 1">
       <INC ="Incorrect option choice 2">
       <INC ="Incorrect option choice 3">
       <EXP ="Explanation of correct choice">
     </QUES>
3. Wrap equations inside text-based tags (H1, H2, TEXT, LIST, QUES) with single dollar signs (e.g., $E=mc^2$).
4. Keep strict 2-space indentation inside container tags (like <PLX> and <QUES>).

[CRITICAL - LANGUAGE DIACRITICS & ACCENTS]:
When converting text containing Yoruba, Igbo, French, Spanish, etc., maintain 100% precision. Because complex diacritics (e.g. dotted high/low tones) can get corrupted across LLM generation layers, you may use either native Unicode characters OR write the following keyboard-friendly typing codes. The CoLearn system compiler will automatically parse and expand them into professional diacritics:

1. Subdots / Underdots (Igbo and Yoruba):
   * o. / O. -> ọ / Ọ
   * u. / U. -> ụ / Ụ
   * i. / I. -> ị / Ị
   * e. / E. -> ẹ / Ẹ
   * s. / S. -> ṣ / Ṣ
   * n. / N. -> ṅ / Ṅ

2. Accent Marks & Tone Marks on Subdots:
   * High tone (Acute) with dot: o.' / ọ' -> ọ́ | e.' / ẹ' -> ẹ́ | u.' / ụ' -> ụ́ | i.' / ị' -> ị́
   * Low tone (Grave) with dot: o.\` / ọ\` -> ọ̀ | e.\` / ẹ\` -> ẹ̀ | u.\` / ụ\` -> ụ̀ | i.\` / ị\` -> ị̀
   * Mid tone (Macron) with dot: o.- / ọ- -> ọ̄ | e.- / ẹ- -> ẹ̄

3. Standard Tone Shorthands:
   * High tone (Acute): a' -> á | e' -> é | i' -> í | o' -> ó | u' -> ú | m' -> ḿ | n' -> ń
   * Low tone (Grave): a\` -> à | e\` -> è | i\` -> ì | o\` -> ò | u\` -> ù
   * Mid tone (Macron): a- -> ā | e- -> ē | i- -> ī | o- -> ō | u- -> ū | m- -> m̄ | n- -> n̄

4. European Diacritics:
   * Cedilla: c, / C, -> ç / Ç
   * Circumflex: a^ -> â | e^ -> ê | i^ -> î | o^ -> ô | u^ -> û
   * Umlaut (Diaeresis): e: -> ë | i: -> ï | u: -> ü
   * Tilde: n~ -> ñ

[OUTPUT RULES]:
- Output raw PLX format text strictly without markdown fences or preamble.
- Write naturally, incorporating both native unicode diacritics and shorthands for full resilience.`;

interface SortableBlockProps {
  block: NoteBlock;
  onUpdate: (id: string, content: string, settings?: any) => void;
  onDelete: (id: string) => void;
  onFocus: (id: string, cursorPosition: number) => void;
  isPreview?: boolean;
}

const SortableBlock = ({ block, onUpdate, onDelete, onFocus, isPreview }: SortableBlockProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id, disabled: isPreview });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = () => {
    if (textareaRef.current) {
      onFocus(block.id, textareaRef.current.selectionStart);
    }
  };

  if (isPreview) {
    return (
      <div className="mb-6">
        {block.type === 'h1' && (
          <h1 className="text-3xl font-bold mb-4">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {prepareMarkdownMath(block.content)}
            </ReactMarkdown>
          </h1>
        )}
        {block.type === 'h2' && (
          <h2 className="text-2xl font-bold mb-3">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {prepareMarkdownMath(block.content)}
            </ReactMarkdown>
          </h2>
        )}
        {block.type === 'text' && (
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {prepareMarkdownMath(block.content)}
            </ReactMarkdown>
          </div>
        )}
        {block.type === 'math' && block.content && (
          <div className="py-4 flex justify-center bg-muted/30 rounded-lg overflow-x-auto">
            <SafeMathRenderer math={block.content} block={true} />
          </div>
        )}
        {block.type === 'table' && block.content && (
          <div className="overflow-x-auto my-4 border rounded-lg">
            <table className="w-full border-collapse">
              <tbody>
                {(() => {
                  try {
                    const data = JSON.parse(block.content);
                    return data.map((row: string[], rowIndex: number) => (
                      <tr key={rowIndex}>
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className="border p-2 text-sm">
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                              {prepareMarkdownMath(cell)}
                            </ReactMarkdown>
                          </td>
                        ))}
                      </tr>
                    ));
                  } catch (e) {
                    return <tr><td className="p-4 text-destructive">Invalid table data</td></tr>;
                  }
                })()}
              </tbody>
            </table>
          </div>
        )}
        {block.type === 'diagram' && block.content && (
          <div className="flex justify-center py-4">
            <img 
              src={block.content} 
              alt="Diagram" 
              className="max-w-full h-auto rounded-lg shadow-md"
              referrerPolicy="no-referrer"
              style={{
                width: block.settings?.width || 'auto',
                height: block.settings?.height || 'auto',
                transform: `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`,
              }}
            />
          </div>
        )}
        {block.type === 'video' && block.content && (
          <div className="w-full my-4 rounded-xl overflow-hidden shadow-lg border border-white/5">
            <VideoPlayer 
              url={block.content} 
              title="Step Video" 
            />
          </div>
        )}
        {(block.type === 'bullet-list' || block.type === 'numbered-list') && (
          <div className="prose dark:prose-invert max-w-none my-6">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {prepareMarkdownMath(block.content)}
            </ReactMarkdown>
          </div>
        )}
        {block.type === 'question' && block.content && (
          <Card className="my-6 border-2 border-primary/20 overflow-hidden">
            <div className="bg-primary/5 p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <HelpCircle className="h-4 w-4" />
                Question {block.settings?.questionId ? `#${block.settings.questionId}` : ''}
              </div>
              <Badge variant="outline" className="text-[10px]">PLX v4</Badge>
            </div>
            <CardContent className="p-6 space-y-4">
              {(() => {
                try {
                  const data = JSON.parse(block.content);
                  return (
                    <>
                      <div className="text-lg font-medium">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {prepareMarkdownMath(data.question)}
                        </ReactMarkdown>
                      </div>
                      <div className="grid gap-2">
                        {data.correct && (
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-500/5 border-green-500/20">
                            <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <span className="text-sm">
                               <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {prepareMarkdownMath(data.correct)}
                              </ReactMarkdown>
                            </span>
                          </div>
                        )}
                        {data.incorrect?.map((inc: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 border-border/50">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                              <XCircle className="h-4 w-4" />
                            </div>
                            <span className="text-sm">
                              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {prepareMarkdownMath(inc)}
                              </ReactMarkdown>
                            </span>
                          </div>
                        ))}
                      </div>
                      {data.explanation && (
                        <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                          <div className="text-[10px] uppercase font-bold text-primary mb-1 tracking-widest flex items-center gap-2">
                            <Wand2 className="h-3 w-3" /> Explanation
                          </div>
                          <div className="text-sm text-muted-foreground italic">
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                              {prepareMarkdownMath(data.explanation)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </>
                  );
                } catch (e) {
                  return <div className="text-destructive">Invalid question data</div>;
                }
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-2 items-start mb-4">
      <div 
        {...attributes} 
        {...listeners} 
        className="mt-3 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-2">
        {block.type === 'h1' && (
          <Input 
            value={block.content} 
            onChange={(e) => onUpdate(block.id, e.target.value)}
            onFocus={handleFocus}
            className="text-2xl font-bold border-none px-0 focus-visible:ring-0 placeholder:opacity-50"
            placeholder="Heading 1"
          />
        )}
        {block.type === 'h2' && (
          <Input 
            value={block.content} 
            onChange={(e) => onUpdate(block.id, e.target.value)}
            onFocus={handleFocus}
            className="text-xl font-bold border-none px-0 focus-visible:ring-0 placeholder:opacity-50"
            placeholder="Heading 2"
          />
        )}
        {block.type === 'text' && (
          <Textarea 
            ref={textareaRef}
            value={block.content} 
            onChange={(e) => onUpdate(block.id, e.target.value)}
            onFocus={handleFocus}
            onKeyUp={handleFocus}
            onClick={handleFocus}
            className="min-h-[80px] resize-none border-none px-0 focus-visible:ring-0 placeholder:opacity-50"
            placeholder="Start typing your notes... Use $math$ for inline LaTeX."
          />
        )}
        {block.type === 'math' && (
          <div className="space-y-2">
            <Textarea 
              ref={textareaRef}
              value={block.content} 
              onChange={(e) => onUpdate(block.id, e.target.value)}
              onFocus={handleFocus}
              onKeyUp={handleFocus}
              onClick={handleFocus}
              className="font-mono text-sm bg-muted/50 border-none focus-visible:ring-0"
              placeholder="Enter LaTeX here (e.g., E = mc^2)"
            />
            {block.content && (
              <div className="p-4 bg-muted/30 rounded-lg flex justify-center overflow-x-auto">
                <SafeMathRenderer math={block.content} block={true} />
              </div>
            )}
          </div>
        )}
        {block.type === 'table' && (
          <div className="p-4 space-y-4">
            <div className="overflow-x-auto border rounded-xl bg-muted/10 p-4">
              <table className="w-full border-collapse min-w-[600px]">
                <tbody>
                  {(() => {
                    try {
                      const data = JSON.parse(block.content);
                      return data.map((row: string[], rowIndex: number) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => (
                            <td key={colIndex} className="border bg-background p-2">
                              <Textarea
                                className="min-h-[60px] w-full text-xs bg-transparent border-none focus-visible:ring-0 resize-none p-1"
                                value={cell}
                                onChange={(e) => {
                                  const newData = [...data];
                                  newData[rowIndex][colIndex] = e.target.value;
                                  onUpdate(block.id, JSON.stringify(newData));
                                }}
                                onFocus={handleFocus}
                                placeholder="Text, math or image URL..."
                              />
                            </td>
                          ))}
                        </tr>
                      ));
                    } catch (e) {
                      return <tr><td className="p-4 text-destructive">Invalid table data</td></tr>;
                    }
                  })()}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Sigma className="h-3 w-3" /> Use $...$ for math
              </div>
              <div className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> Paste URL for diagrams
              </div>
            </div>
          </div>
        )}
        {block.type === 'diagram' && (
          <div className="space-y-4">
            <Input 
              value={block.content} 
              onChange={(e) => onUpdate(block.id, e.target.value)}
              placeholder="Enter Image/Diagram URL"
              className="bg-muted/50 border-none focus-visible:ring-0"
            />
            {block.content && (
              <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-xl p-8 bg-muted/5 flex justify-center min-h-[200px]">
                    <Rnd
                      size={{ 
                        width: block.settings?.width || 300, 
                        height: block.settings?.height || 200 
                      }}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        onUpdate(block.id, block.content, {
                          ...block.settings,
                          width: parseInt(ref.style.width),
                          height: parseInt(ref.style.height)
                        });
                      }}
                      lockAspectRatio={block.settings?.aspectRatio}
                      minWidth={50}
                      minHeight={50}
                      enableResizing={{
                        top: true, right: true, bottom: true, left: true,
                        topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
                      }}
                      className="relative group/rnd border border-transparent hover:border-primary/50 transition-colors"
                      disableDragging={true}
                    >
                      <div className="relative w-full h-full">
                        <img 
                          src={block.content} 
                          alt="Diagram" 
                          className="w-full h-full object-contain select-none pointer-events-none"
                          style={{
                            transform: `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`
                          }}
                          referrerPolicy="no-referrer"
                        />
                        
                        {/* Custom Resize Handles Indicators */}
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full opacity-0 group-hover/rnd:opacity-100 transition-opacity" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full opacity-0 group-hover/rnd:opacity-100 transition-opacity" />
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full opacity-0 group-hover/rnd:opacity-100 transition-opacity" />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full opacity-0 group-hover/rnd:opacity-100 transition-opacity" />

                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-background border shadow-lg rounded-lg p-1 opacity-0 group-hover/rnd:opacity-100 transition-opacity z-50">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => onUpdate(block.id, block.content, { ...block.settings, flipX: !block.settings?.flipX })}
                      >
                        <FlipHorizontal className="h-3 w-3" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => onUpdate(block.id, block.content, { ...block.settings, flipY: !block.settings?.flipY })}
                      >
                        <FlipVertical className="h-3 w-3" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onUpdate(block.id, block.content, { ...block.settings, aspectRatio: !block.settings?.aspectRatio })}
                        className={cn("h-7 w-7", block.settings?.aspectRatio ? "text-primary bg-primary/10" : "")}
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Rnd>
              </div>
            )}
          </div>
        )}
        {block.type === 'video' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-pink-500" />
              <Input 
                value={block.content} 
                onChange={(e) => onUpdate(block.id, e.target.value)}
                placeholder="Enter Video URL (YouTube embed or direct link)"
                className="bg-muted/50 border-none focus-visible:ring-0"
              />
            </div>
            {block.content && (
              <div className="w-full rounded-xl overflow-hidden bg-muted/10 border border-white/5 flex items-center justify-center">
                <VideoPlayer 
                  url={block.content} 
                  title="Preview Video" 
                />
              </div>
            )}
          </div>
        )}
        {(block.type === 'bullet-list' || block.type === 'numbered-list') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 px-1">
              {block.type === 'bullet-list' ? <List className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
              <span>{block.type === 'bullet-list' ? 'Bullet Points' : 'Numbered List'} (Use - or 1. for items)</span>
            </div>
            <Textarea 
              ref={textareaRef}
              value={block.content} 
              onChange={(e) => onUpdate(block.id, e.target.value)}
              onFocus={handleFocus}
              onKeyUp={handleFocus}
              onClick={handleFocus}
              className="min-h-[120px] resize-none border-none px-0 focus-visible:ring-0 placeholder:opacity-50 font-mono text-sm"
              placeholder={block.type === 'bullet-list' ? "- Item 1\n- Item 2" : "1. First\n2. Second"}
            />
          </div>
        )}
        {block.type === 'question' && (
          <div className="space-y-4 p-4 bg-muted/10 rounded-xl border border-primary/10">
            <div className="flex items-center gap-2 text-sm font-bold text-primary mb-2">
              <HelpCircle className="h-4 w-4" />
              Question Builder
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Question ID / Number</Label>
              <Input 
                value={block.settings?.questionId || ''} 
                onChange={(e) => onUpdate(block.id, block.content, { ...block.settings, questionId: e.target.value })}
                placeholder="e.g. 1"
                className="h-8 bg-background"
              />
            </div>
            {(() => {
              try {
                const data = JSON.parse(block.content || '{"question":"","correct":"","incorrect":[""],"explanation":""}');
                return (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Question Text</Label>
                      <Textarea 
                        value={data.question}
                        onChange={(e) => onUpdate(block.id, JSON.stringify({ ...data, question: e.target.value }))}
                        className="min-h-[60px] bg-background text-sm"
                        placeholder="What is...?"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-green-600">Correct Answer</Label>
                      <Input 
                        value={data.correct}
                        onChange={(e) => onUpdate(block.id, JSON.stringify({ ...data, correct: e.target.value }))}
                        className="bg-background text-sm border-green-500/20"
                        placeholder="The right answer"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-red-400">Incorrect Answers</Label>
                      <div className="space-y-2">
                        {data.incorrect?.map((inc: string, i: number) => (
                          <div key={i} className="flex gap-2">
                            <Input 
                              value={inc}
                              onChange={(e) => {
                                const newInc = [...data.incorrect];
                                newInc[i] = e.target.value;
                                onUpdate(block.id, JSON.stringify({ ...data, incorrect: newInc }));
                              }}
                              className="bg-background text-sm"
                              placeholder={`Option ${i+1}`}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-muted-foreground"
                              onClick={() => {
                                const newInc = data.incorrect.filter((_: any, idx: number) => idx !== i);
                                onUpdate(block.id, JSON.stringify({ ...data, incorrect: newInc }));
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-[10px] h-7 border-dashed"
                          onClick={() => {
                            const newInc = [...(data.incorrect || []), ""];
                            onUpdate(block.id, JSON.stringify({ ...data, incorrect: newInc }));
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Option
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-primary">Explanation (Optional)</Label>
                      <Textarea 
                        value={data.explanation || ''}
                        onChange={(e) => onUpdate(block.id, JSON.stringify({ ...data, explanation: e.target.value }))}
                        className="min-h-[60px] bg-background text-sm border-primary/20"
                        placeholder="Explain why the answer is correct..."
                      />
                    </div>
                  </div>
                );
              } catch (e) {
                return (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => onUpdate(block.id, JSON.stringify({ question: "", correct: "", incorrect: [""], explanation: "" }))}
                  >
                    Reset Question Schema
                  </Button>
                );
              }
            })()}
          </div>
        )}
      </div>

      <Button 
        type="button"
        variant="ghost" 
        size="icon" 
        onClick={() => onDelete(block.id)}
        className="mt-2 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const applyAccentShortcuts = (text: string): string => {
  let res = text;
  
  // Dotted + High/Low/Mid tone replacements for Igbo & Yoruba (e.g. o.' -> ọ́, o.` -> ọ̀, o.- -> ọ̄)
  res = res.replace(/o\.'|ọ'/g, 'ọ́');
  res = res.replace(/u\.'|ụ'/g, 'ụ́');
  res = res.replace(/i\.'|ị'/g, 'ị́');
  res = res.replace(/e\.'|ẹ'/g, 'ẹ́');
  res = res.replace(/O\.'|Ọ'/g, 'Ọ́');
  res = res.replace(/U\.'|Ụ'/g, 'Ụ́');
  res = res.replace(/I\.'|Ị'/g, 'Ị́');
  res = res.replace(/E\.'|Ẹ'/g, 'Ẹ́');
  
  res = res.replace(/o\.`|ọ`/g, 'ọ̀');
  res = res.replace(/u\.`|ụ`/g, 'ụ̀');
  res = res.replace(/i\.`|ị'/g, 'ị̀');
  res = res.replace(/e\.`|ẹ`/g, 'ẹ̀');
  res = res.replace(/O\.`|Ọ`/g, 'Ọ̀');
  res = res.replace(/U\.`|Ụ`/g, 'Ụ̀');
  res = res.replace(/I\.`|Ị'/g, 'Ị̀');
  res = res.replace(/E\.`|Ẹ`/g, 'Ẹ̀');

  res = res.replace(/o\.-|ọ-/g, 'ọ̄');
  res = res.replace(/e\.-|ẹ-/g, 'ẹ̄');
  res = res.replace(/O\.-|Ọ-/g, 'Ọ̄');
  res = res.replace(/E\.-|Ẹ-/g, 'Ẹ̄');

  // Umlaut / Diaeresis (e.g. e: -> ë, i: -> ï)
  res = res.replace(/e:/g, 'ë');
  res = res.replace(/i:/g, 'ï');
  res = res.replace(/u:/g, 'ü');
  res = res.replace(/E:/g, 'Ë');
  res = res.replace(/I:/g, 'Ï');
  res = res.replace(/U:/g, 'Ü');

  // Simple dots for Igbo & Yoruba
  res = res.replace(/o\./g, 'ọ');
  res = res.replace(/u\./g, 'ụ');
  res = res.replace(/i\./g, 'ị');
  res = res.replace(/e\./g, 'ẹ');
  res = res.replace(/s\./g, 'ṣ');
  res = res.replace(/n\./g, 'ṅ');
  res = res.replace(/O\./g, 'Ọ');
  res = res.replace(/U\./g, 'Ụ');
  res = res.replace(/I\./g, 'Ị');
  res = res.replace(/E\./g, 'Ẹ');
  res = res.replace(/S\./g, 'Ṣ');
  res = res.replace(/N\./g, 'Ṅ');
  res = res.replace(/n~/g, 'ñ');
  res = res.replace(/N~/g, 'Ñ');

  // Acute accents (e.g. a' -> á)
  res = res.replace(/a'/g, 'á');
  res = res.replace(/e'/g, 'é');
  res = res.replace(/i'/g, 'í');
  res = res.replace(/o'/g, 'ó');
  res = res.replace(/u'/g, 'ú');
  res = res.replace(/A'/g, 'Á');
  res = res.replace(/E'/g, 'É');
  res = res.replace(/I'/g, 'Í');
  res = res.replace(/O'/g, 'Ó');
  res = res.replace(/U'/g, 'Ú');
  res = res.replace(/m'/g, 'ḿ');
  res = res.replace(/n'/g, 'ń');
  res = res.replace(/M'/g, 'Ḿ');
  res = res.replace(/N'/g, 'Ń');

  // Grave accents (e.g. a` -> à)
  res = res.replace(/a`/g, 'à');
  res = res.replace(/e`/g, 'è');
  res = res.replace(/i`/g, 'ì');
  res = res.replace(/o`/g, 'ò');
  res = res.replace(/u`/g, 'ù');
  res = res.replace(/A`/g, 'À');
  res = res.replace(/E`/g, 'È');
  res = res.replace(/I`/g, 'Ì');
  res = res.replace(/O`/g, 'Ò');
  res = res.replace(/U`/g, 'Ù');

  // Macron / Mid voice (e.g. a- -> ā)
  res = res.replace(/a-/g, 'ā');
  res = res.replace(/e-/g, 'ē');
  res = res.replace(/i-/g, 'ī');
  res = res.replace(/o-/g, 'ō');
  res = res.replace(/u-/g, 'ū');
  res = res.replace(/A-/g, 'Ā');
  res = res.replace(/E-/g, 'Ē');
  res = res.replace(/I-/g, 'Ī');
  res = res.replace(/O-/g, 'Ō');
  res = res.replace(/U-/g, 'Ū');
  res = res.replace(/m-/g, 'm̄');
  res = res.replace(/n-/g, 'n̄');
  res = res.replace(/M-/g, 'M̄');
  res = res.replace(/N-/g, 'N̄');

  // Cedilla for French (c, -> ç)
  res = res.replace(/c,/g, 'ç');
  res = res.replace(/C,/g, 'Ç');

  // Circumflex (e.g. a^ -> â)
  res = res.replace(/a\^/g, 'â');
  res = res.replace(/e\^/g, 'ê');
  res = res.replace(/i\^/g, 'î');
  res = res.replace(/o\^/g, 'ô');
  res = res.replace(/u\^/g, 'û');
  res = res.replace(/A\^/g, 'Â');
  res = res.replace(/E\^/g, 'Ê');
  res = res.replace(/I\^/g, 'Î');
  res = res.replace(/O\^/g, 'Ô');
  res = res.replace(/U\^/g, 'Û');

  // Ligatures (oe -> œ, ae -> æ)
  res = res.replace(/oe/g, 'œ');
  res = res.replace(/ae/g, 'æ');
  res = res.replace(/OE/g, 'Œ');
  res = res.replace(/AE/g, 'Æ');

  return res;
};

interface NoteBuilderProps {
  initialContent?: string;
  onChange: (content: string) => void;
  mode?: 'create' | 'edit';
}

export const NoteRenderer: React.FC<{ content: string }> = ({ content }) => {
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);

  useEffect(() => {
    if (content) {
      try {
        setBlocks(JSON.parse(content));
      } catch (e) {
        setBlocks([{ id: '1', type: 'text', content: content }]);
      }
    }
  }, [content]);

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <SortableBlock 
          key={block.id} 
          block={block} 
          onUpdate={() => {}}
          onDelete={() => {}}
          onFocus={() => {}}
          isPreview={true}
        />
      ))}
    </div>
  );
};

export const NoteBuilder: React.FC<NoteBuilderProps> = ({ initialContent, onChange, mode = 'create' }) => {
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => {
    if (initialContent) {
      try {
        return JSON.parse(initialContent);
      } catch (e) {
        return [{ id: '1', type: 'text', content: initialContent }];
      }
    }
    return [{ id: '1', type: 'text', content: '' }];
  });

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeToolbarTab, setActiveToolbarTab] = useState<'math' | 'lang'>('math');
  const [cursorPos, setCursorPos] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isMagicDialogOpen, setIsMagicDialogOpen] = useState(false);
  const [isAiPromptDialogOpen, setIsAiPromptDialogOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Mathematics: true,
    Physics: true,
    Chemistry: true,
    "Igbo (Ọnwụ)": true,
    "French (Français)": true,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'magicNote'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AIConfig;
        console.log('Magic Note AI Config loaded:', {
          provider: data.provider,
          model: data.model,
          hasApiKey: !!data.apiKey,
          apiKeyPreview: data.apiKey ? `${data.apiKey.substring(0, 4)}...${data.apiKey.substring(data.apiKey.length - 4)}` : 'none'
        });
        setAiConfig(data);
      } else {
        console.warn('Magic Note AI Config (system/magicNote) does not exist in Firestore.');
      }
    });
    return () => unsub();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateBlocks = useCallback((newBlocks: NoteBlock[]) => {
    setBlocks(newBlocks);
    onChange(JSON.stringify(newBlocks));
  }, [onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      updateBlocks(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: NoteBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      settings: type === 'diagram' ? { width: 300, height: 200, aspectRatio: true } : undefined
    };
    updateBlocks([...blocks, newBlock]);
  };

  const updateBlockContent = (id: string, content: string, settings?: any) => {
    updateBlocks(blocks.map(b => b.id === id ? { ...b, content, settings: settings || b.settings } : b));
  };

  const deleteBlock = (id: string) => {
    if (blocks.length === 1) return;
    updateBlocks(blocks.filter(b => b.id !== id));
  };

  const addTable = () => {
    const emptyRow = Array(tableCols).fill('');
    const grid = Array(tableRows).fill(null).map(() => [...emptyRow]);
    const newBlock: NoteBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'table',
      content: JSON.stringify(grid)
    };
    updateBlocks([...blocks, newBlock]);
    setIsTableDialogOpen(false);
  };


  // ─── PDF → Images converter using PDF.js (loaded from CDN, no install needed) ──
  // ── PDF.js loader (text extraction only — no image rendering) ───────────────
  const loadPdfJs = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Suppress font fetch warnings — we only need text, not rendering
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
    return (window as any).pdfjsLib;
  };

  // Extract plain text from all PDF pages — fast, no image conversion, no size limits
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      // Disable font fetching entirely — we only need text content
      disableFontFace: true,
      useSystemFonts: false,
      standardFontDataUrl: undefined,
    }).promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      // Join text items, preserving line breaks via transform y-position changes
      let lastY: number | null = null;
      const lines: string[] = [];
      let currentLine = '';
      for (const item of textContent.items as any[]) {
        const y = item.transform?.[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += item.str;
        lastY = y;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      pageTexts.push(lines.join('\n'));
    }
    return pageTexts.join('\n\n--- Page Break ---\n\n');
  };

  const handleMagicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50MB)");
      return;
    }

    setIsMagicLoading(true);
    const existingBlocks = blocks.length === 1 && blocks[0].content === '' ? [] : blocks;

    try {
      let resultBlocks: any[] = [];

      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'plx' || file.type === 'text/plain') {
        // ── PLX / TEXT: Parse standard format (v4 HTML-style) ────────────────
        let loadedText = await file.text();
        // Automatically compile keyboard friendly accent/intonation shortcuts
        loadedText = applyAccentShortcuts(loadedText);
        
        // Requirement: Entire note must be wrapped in <PLX> tags
        const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(loadedText);
        if (!plxMatch) {
          toast.error('Invalid PLX format: Missing root <PLX> tags');
          setIsMagicLoading(false);
          return;
        }
        
        const text = plxMatch[1].trim();
        
        // Match both v1 [TAG] and v2/v4 <TAG>content</TAG> for backwards compatibility
        const validTags = ['H1', 'H2', 'TEXT', 'B', 'MATH', 'LIST', 'ORDERED', 'TABLE', 'VIDEO', 'DIAGRAM', 'QUES'];
        const tagRegex = /<(H1|H2|TEXT|B|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
        
        let match;
        let foundV2 = false;
        
        while ((match = tagRegex.exec(text)) !== null) {
          foundV2 = true;
          const tagName = match[1].toUpperCase();
          const attr = match[2] || '';
          let content = match[3].trim();
          
          // Pre-processing: Support internal <B> tags by converting them to Markdown bold
          content = content.replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**');
          
          // Indentation Stripper: Remove common leading whitespace from each line 
          // This prevents lists from being rendered as code blocks in ReactMarkdown
          const lines = content.split('\n');
          const minIndent = lines
            .filter(line => line.trim().length > 0)
            .reduce((min, line) => {
              const match = line.match(/^(\s*)/);
              return match ? Math.min(min, match[1].length) : min;
            }, Infinity);
          
          if (minIndent !== Infinity && minIndent > 0) {
            content = lines.map(line => line.slice(minIndent)).join('\n');
          }

          if (tagName === 'TABLE') {
            // Revamped: Parse CSV-style content to JSON array of arrays
            const rows = content.split('\n')
              .filter(row => row.trim().length > 0)
              .map(row => row.split(',').map(cell => cell.trim()));
            content = JSON.stringify(rows.length > 0 ? rows : [['']]);
          }

          if (tagName === 'QUES') {
            // Robust parsing for internal subtags <COR ="...">, <INC ="..."> and <EXP ="...">
            // Handles both quoted and unquoted attributes, and self-closing or paired tags
            const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(content);
            const incMatches = [...content.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
            const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(content);
            
            // Extract the question text (everything before the first COR/INC/EXP subtag)
            const firstSubTag = content.search(/<(COR|INC|EXP)/i);
            const questionBody = firstSubTag === -1 ? content.trim() : content.substring(0, firstSubTag).trim();
            
            const qData = {
              question: questionBody,
              correct: corMatch ? (corMatch[1] || corMatch[2] || '') : '',
              incorrect: incMatches.map(m => m[1] || m[2] || '').filter(Boolean),
              explanation: expMatch ? (expMatch[1] || expMatch[2] || '') : ''
            };
            
            resultBlocks.push({ 
              type: 'question', 
              content: JSON.stringify(qData),
              settings: { questionId: attr }
            });
            continue;
          }

          const typeMap: Record<string, string> = {
            'H1': 'h1',
            'H2': 'h2',
            'TEXT': 'text',
            'B': 'text',
            'MATH': 'math',
            'LIST': 'bullet-list',
            'ORDERED': 'numbered-list',
            'TABLE': 'table',
            'VIDEO': 'video',
            'DIAGRAM': 'diagram'
          };
          let finalContent = content;
          if (tagName === 'B') {
            finalContent = `**${content}**`;
          }
          resultBlocks.push({ type: typeMap[tagName] || 'text', content: finalContent, settings: attr ? { questionId: attr } : undefined });
        }

        if (!foundV2) {
          // Fallback to legacy bracket parsing
          const plxRegex = /\[(H1|H2|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM)\]/g;
          if (plxRegex.test(text)) {
            toast.loading('Parsing legacy PLX format...', { id: 'plx-status' });
            const parts = text.split(/\[(H1|H2|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM)\]/g);
            for (let i = 1; i < parts.length; i += 2) {
              const tagName = parts[i];
              let content = parts[i+1]?.trim() || '';

              if (tagName === 'TABLE') {
                const rows = content.split('\n')
                  .filter(row => row.trim().length > 0)
                  .map(row => row.split(',').map(cell => cell.trim()));
                content = JSON.stringify(rows.length > 0 ? rows : [['']]);
              }

              const typeMap: Record<string, string> = {
                'H1': 'h1', 'H2': 'h2', 'MATH': 'math', 'LIST': 'bullet-list',
                'ORDERED': 'numbered-list', 'TABLE': 'table', 'VIDEO': 'video', 'DIAGRAM': 'diagram'
              };
              resultBlocks.push({ type: typeMap[tagName] || 'text', content });
            }
          } else if (fileExtension === 'plx') {
            throw new Error('Invalid PLX format. No valid tags (<H1> or [H1]) found.');
          } else {
            resultBlocks = [{ type: 'text', content: text }];
          }
        }
        
        toast.dismiss('plx-status');
      } else if (file.type === 'application/pdf') {
        // ── PDF: extract text → AI help (or fallback) ───────────────────────
        toast.loading('Extracting PDF text…', { id: 'pdf-status' });
        const pdfText = await extractPdfText(file);
        toast.dismiss('pdf-status');

        if (!pdfText.trim()) {
          throw new Error('No text found in PDF. Scanned PDFs are not supported yet.');
        }

        resultBlocks = await magicNoteCreator(
          { data: pdfText, mimeType: 'text/plain' },
          aiConfig || undefined
        );

      } else if (file.type.startsWith('image/')) {
        // ── Image: send directly via vision ───────────────────────────────────
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        resultBlocks = await magicNoteCreator(
          { data: base64, mimeType: file.type },
          aiConfig || undefined
        );
      } else {
        throw new Error('Unsupported file type. Please upload a .plx, .txt, .pdf, or image file.');
      }

      const uniqueBlocks = resultBlocks.map((b: any) => ({
        ...b,
        id: Math.random().toString(36).substr(2, 9)
      }));
      updateBlocks([...existingBlocks, ...uniqueBlocks]);
      toast.success('Note added successfully!');
      setIsMagicDialogOpen(false);

    } catch (error: any) {
      toast.dismiss('pdf-status');
      toast.dismiss('plx-status');
      toast.error(error.message || 'Failed to process file');
    } finally {
      setIsMagicLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadPLXStandard = () => {
    const standard = `[COLEARN NOTE STANDARD - PLX v4.0]

PLX (Pillara Extensible) uses a structured HTML-style syntax. 
AI models understand this tags-based format much better than brackets.

CRITICAL: USE PROPER INDENTATION
Indentation is essential for clarity. Sub-elements and content inside tags should be clearly indented.
Use 2 spaces per indentation level.

[SUPPORTED TAGS]:

<PLX>
  All content must be wrapped in a root <PLX> tag.
</PLX>

<H1>
  Main Title of the Note
</H1>

<H2>
  Sub-header or Section Title
</H2>

<TEXT>
  This is a regular text block. You can use <B>bold</B> for emphasis.
</TEXT>

<B>
  This entire block will be bolded for extreme emphasis.
</B>

<QUES ="1">
  Who founded CoLearn?
  <COR ="Pillara Education 2026">
  <INC ="Microsoft">
  <INC ="Google">
  <INC ="Apple">
  <EXP ="CoLearn was founded by Pillara Education 2026 to revolutionize learning.">
</QUES>
*Note: COR = Correct Answer, INC = Incorrect Answer, EXP = Explanation.

<MATH>
  Block level LaTeX. Example: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}
</MATH>

<LIST>
  - Use bullet points
  - For unordered information
</LIST>

<ORDERED>
  1. Use numbers
  2. For step-by-step processes
</ORDERED>

<TABLE>
  Name, Age, Department
  John Doe, 19, Physics
  Jane Smith, 21, Engineering
</TABLE>
*Note: Tables are CSV-style (comma separated). 

<VIDEO>
  https://www.youtube.com/watch?v=example
</VIDEO>

<DIAGRAM>
  Use mermaid or text-based diagrams here.
</DIAGRAM>

[INLINE LATEX]:
You can use inline LaTeX inside any text-based tag (H1, H2, LIST, QUES etc.) by wrapping it in dollar signs.
Example: The area of a circle is $A = \\pi r^2$ where $r$ is radius.

[LANGUAGE ACCENTS & INTU-SHORTHAND COMPLIANCE]:
When writing language content with diacritics, tonals, or subdots (Igbo, Yoruba, French, Spanish, etc.), maintain 100% precision. The platform's interpreter translates raw Unicode and automatically compiles keyboard-friendly shorthand codes embedded in the notes into standard high-fidelity diacritics:

1. Subdots / Underdots (Igbo/Yoruba):
   - o. / O. -> ọ / Ọ
   - u. / U. -> ụ / Ụ
   - i. / I. -> ị / Ị
   - e. / E. -> ẹ / Ẹ
   - s. / S. -> ṣ / Ṣ
   - n. / N. -> ṅ / Ṅ

2. Vowel Accent & Tonals (Igbo/Yoruba High & Low tones):
   - High tone over subdot:
     * o.' / ọ' -> ọ́
     * u.' / ụ' -> ụ́
     * i.' / ị' -> ị́
     * e.' / ẹ' -> ẹ́
     * O.' / Ọ' -> Ọ́
   - Low tone over subdot:
     * o.\` / ọ\` -> ọ̀
     * u.\` / ụ\` -> ụ̀
     * i.\` / ị\` -> ị̀
     * e.\` / ẹ\` -> ẹ̀
     * O.\` / Ọ\` -> Ọ̀
   - Mid tone / macron over subdot:
     * o.- / ọ- -> ọ̄
     * e.- / ẹ- -> ẹ̄
   - Standard Tonal/Accent Shortcuts:
     * High tone (Acute): a' -> á, e' -> é, i' -> í, o' -> ó, u' -> ú, m' -> ḿ, n' -> ń
     * Low tone (Grave): a\` -> à, e\` -> è, i\` -> ì, o\` -> ò, u\` -> ù
     * Mid/macron: a- -> ā, e- -> ē, i- -> ī, o- -> ō, u- -> ū, m- -> m̄, n- -> n̄

3. European Diacritics:
   - French Cedilla: c, / C, -> ç / Ç
   - French/Spanish Circumflex: a^ -> â, e^ -> ê, i^ -> î, o^ -> ô, u^ -> û
   - Umlaut (Diaeresis): e: -> ë, i: -> ï, u: -> ü
   - Tilde: n~ -> ñ

[AI PROMPT STRATEGY]:
1. "Analyze the provided technical/lecture content."
2. "Convert it into a valid CoLearn PLX document wrapped in <PLX> tags using <TAG>... </TAG> syntax internally."
3. "Always start with <PLX> and end with </PLX>."
4. "Keep 100% structural fidelity of language marks, using the correct native Unicode values OR compiling them via the intuitive [LANGUAGE ACCENTS & INTU-SHORTHAND COMPLIANCE] rules (e.g., writing 'pẹ̀lẹ́' or 'pẹ.\`lẹ.\'' so the platform compiles them perfectly)."
5. "Use <QUES ="#"> for any testable questions found in the material."
6. "Use CSV format for Tables (Heading1, Heading2 followed by data rows)."
7. "Use $...$ for equations that appear inside sentences."
8. "Maintain strict 2-space indentation inside all container tags."
9. "Ensure every opening tag has a matching closing tag."

[SAVE INSTRUCTIONS]:
Save the final text as a file named "note.plx" (or .txt) then upload it.
`;
    const blob = new Blob([standard], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'COLEARN_STANDARD.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('PLX Standard downloaded as .txt');
  };

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(DEEPSEEK_PROMPT_GUIDE);
    setCopiedPrompt(true);
    toast.success('AI Prompt Copied! Paste this directly into DeepSeek/ChatGTP.');
    setTimeout(() => {
      setCopiedPrompt(false);
    }, 2000);
  };

  const downloadNoteAsPLX = () => {
    let plxContent = "<PLX>\n";
    blocks.forEach(block => {
      const type = block.type;
      const content = block.content;
      
      if (type === 'h1') {
        plxContent += `  <H1>\n    ${content}\n  </H1>\n\n`;
      } else if (type === 'h2') {
        plxContent += `  <H2>\n    ${content}\n  </H2>\n\n`;
      } else if (type === 'text') {
        plxContent += `  <TEXT>\n    ${content}\n  </TEXT>\n\n`;
      } else if (type === 'math') {
        plxContent += `  <MATH>\n    ${content}\n  </MATH>\n\n`;
      } else if (type === 'bullet-list') {
        plxContent += `  <LIST>\n    ${content}\n  </LIST>\n\n`;
      } else if (type === 'numbered-list') {
        plxContent += `  <ORDERED>\n    ${content}\n  </ORDERED>\n\n`;
      } else if (type === 'table') {
        try {
          const grid = JSON.parse(content);
          if (Array.isArray(grid)) {
            const csvStr = grid.map(row => (Array.isArray(row) ? row.join(', ') : '')).join('\n');
            plxContent += `  <TABLE>\n    ${csvStr}\n  </TABLE>\n\n`;
          } else {
            plxContent += `  <TABLE>\n    ${content}\n  </TABLE>\n\n`;
          }
        } catch {
          plxContent += `  <TABLE>\n    ${content}\n  </TABLE>\n\n`;
        }
      } else if (type === 'video') {
        plxContent += `  <VIDEO>\n    ${content}\n  </VIDEO>\n\n`;
      } else if (type === 'diagram') {
        plxContent += `  <DIAGRAM>\n    ${content}\n  </DIAGRAM>\n\n`;
      } else if (type === 'question') {
        try {
          const q = JSON.parse(content);
          const qIdAttr = block.settings?.questionId ? ` ="${block.settings.questionId}"` : '';
          plxContent += `  <QUES${qIdAttr}>\n`;
          plxContent += `    ${q.question}\n`;
          if (q.correct) {
            plxContent += `    <COR ="${q.correct}">\n`;
          }
          if (Array.isArray(q.incorrect)) {
            q.incorrect.forEach((inc: string) => {
              if (inc) plxContent += `    <INC ="${inc}">\n`;
            });
          }
          if (q.explanation) {
            plxContent += `    <EXP ="${q.explanation}">\n`;
          }
          plxContent += `  </QUES>\n\n`;
        } catch {
          plxContent += `  <TEXT>\n    ${content}\n  </TEXT>\n\n`;
        }
      }
    });
    plxContent += "</PLX>";

    const blob = new Blob([plxContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'note.plx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Note exported successfully as .plx');
  };

  const insertSymbol = (symbol: string) => {
    if (!activeBlockId) return;
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block || (block.type !== 'text' && block.type !== 'math')) return;

    // Smart wrap $ for text blocks
    let finalSymbol = symbol;
    let insertionPos = cursorPos;
    let contentPrefix = block.content.slice(0, cursorPos);
    let contentSuffix = block.content.slice(cursorPos);

    if (block.type === 'text') {
      const textBefore = contentPrefix;
      const dollarsBefore = (textBefore.match(/\$/g) || []).length;
      
      const isInsideMath = (dollarsBefore % 2 === 1);
      const isJustAfterDollar = textBefore.endsWith('$') && !textBefore.endsWith('\\$');
      
      if (isInsideMath) {
        // We are inside $...$, just insert the symbol
        finalSymbol = symbol;
      } else if (isJustAfterDollar) {
        // We are just after the closing $, insert BEFORE it to stay in the math span
        contentPrefix = contentPrefix.slice(0, -1);
        finalSymbol = symbol + '$';
      } else {
        // We are in plain text, start a new math span
        finalSymbol = `$${symbol}$`;
      }
    }

    const newContent = contentPrefix + finalSymbol + contentSuffix;
    updateBlockContent(activeBlockId, newContent);
    setCursorPos(contentPrefix.length + finalSymbol.length);
  };

  const insertChar = (char: string) => {
    if (!activeBlockId) {
      toast.warning('Please click inside a text field first to focus and insert characters.');
      return;
    }
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block) return;

    // Simply insert at the exact cursor position in the block content
    const contentPrefix = block.content.slice(0, cursorPos);
    const contentSuffix = block.content.slice(cursorPos);
    const newContent = contentPrefix + char + contentSuffix;

    updateBlockContent(activeBlockId, newContent);
    setCursorPos(contentPrefix.length + char.length);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Filtered symbols for search
  const symbolsSource = activeToolbarTab === 'math' ? MATH_SYMBOLS : LANGUAGE_SYMBOLS;
  const filteredSymbols = Object.entries(symbolsSource).reduce((acc, [category, data]) => {
    const filtered = data.symbols.filter(s => {
      const label = typeof s === 'string' ? s : s.label;
      const value = typeof s === 'string' ? s : s.value;
      return label.toLowerCase().includes(searchTerm.toLowerCase()) || 
             value.toLowerCase().includes(searchTerm.toLowerCase());
    });
    if (filtered.length > 0) {
      acc[category] = { ...data, symbols: filtered };
    }
    return acc;
  }, {} as typeof MATH_SYMBOLS);

  return (
    <div className={cn(
      "flex border rounded-xl overflow-hidden bg-background",
      mode === 'edit' ? "h-full" : "h-[800px] min-h-[60vh] max-h-[80vh]"
    )}>
      {/* Left Toolbar */}
      <div className="w-72 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b bg-background space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
            <Sigma className="h-4 w-4 text-primary" /> Syntax & Accent Toolbar
          </h3>
          
          {/* Accent and Syntax tabs toggle */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg text-xs">
            <button
              type="button"
              onClick={() => { setActiveToolbarTab('math'); setSearchTerm(''); }}
              className={cn(
                "py-1.5 rounded-md font-medium transition-all text-center cursor-pointer",
                activeToolbarTab === 'math' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              Math & Science
            </button>
            <button
              type="button"
              onClick={() => { setActiveToolbarTab('lang'); setSearchTerm(''); }}
              className={cn(
                "py-1.5 rounded-md font-medium transition-all text-center cursor-pointer",
                activeToolbarTab === 'lang' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              Language Accents
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={activeToolbarTab === 'math' ? "Search science syntax..." : "Search accents..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              className="pl-9 h-9 text-xs bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {activeToolbarTab === 'lang' && (
            <div className="mb-3 p-2.5 bg-primary/5 border border-primary/10 rounded-lg space-y-2 text-xs transition-all">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Wand2 className="h-3.5 w-3.5 animate-pulse" />
                <span>Shorthand Converter</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                Type standard shortcuts as you write (e.g., <code className="bg-background px-1 rounded border font-mono">o.'</code> &rarr; <strong className="text-foreground">ọ́</strong>, <code className="bg-background px-1 rounded border font-mono">e.</code> &rarr; <strong className="text-foreground">ẹ</strong>, <code className="bg-background px-1 rounded border font-mono">a-</code> &rarr; <strong className="text-foreground">ā</strong>, <code className="bg-background px-1 rounded border font-mono">c,</code> &rarr; <strong className="text-foreground">ç</strong>). Convert them instantly on demand:
              </p>
              <div className="flex gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="default"
                  className="text-[10px] h-7 px-2 flex-1 cursor-pointer"
                  disabled={!activeBlockId}
                  onClick={() => {
                    if (!activeBlockId) return;
                    const b = blocks.find(x => x.id === activeBlockId);
                    if (b) {
                      updateBlockContent(activeBlockId, applyAccentShortcuts(b.content));
                    }
                  }}
                  title={activeBlockId ? "Convert accents inside the currently active block" : "Select a block first to convert"}
                >
                  Active Block
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-[10px] h-7 px-2 flex-1 cursor-pointer"
                  onClick={() => {
                    setBlocks(prev => prev.map(bk => ({
                      ...bk,
                      content: applyAccentShortcuts(bk.content)
                    })));
                  }}
                  title="Convert shorthand accents across the entire note"
                >
                  Entire Note
                </Button>
              </div>

              <div className="pt-2 border-t border-primary/10 flex flex-col gap-1.5">
                <span className="text-[9px] text-muted-foreground font-semibold">Teaching External AI:</span>
                <Button
                  type="button"
                  onClick={() => setIsAiPromptDialogOpen(true)}
                  variant="secondary"
                  className="w-full text-[10px] h-7 px-2 cursor-pointer bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-500 hover:text-amber-800 transition-all flex items-center justify-center gap-1.5 font-semibold"
                >
                  <Copy className="h-3 w-3" />
                  Get DeepSeek Prompt Spec
                </Button>
              </div>
            </div>
          )}

          {Object.entries(filteredSymbols).map(([category, data]) => (
            <div key={category} className="space-y-1">
              <button 
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-lg text-xs font-semibold uppercase tracking-wider text-muted-foreground/90 hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  {data.icon}
                  {category}
                </span>
                {expandedCategories[category] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedCategories[category] && (
                <div className="grid grid-cols-4 gap-1 p-1">
                  {data.symbols.map((s, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-full p-0 flex flex-col items-center justify-center hover:bg-primary/10 hover:text-primary transition-all group border border-transparent hover:border-primary/20 rounded"
                      onClick={() => {
                        if (activeToolbarTab === 'math') {
                          insertSymbol(typeof s === 'string' ? s : s.value);
                        } else {
                          insertChar(typeof s === 'string' ? s : s.value);
                        }
                      }}
                      title={typeof s === 'string' ? s : `${s.label}: ${s.value}`}
                    >
                      {activeToolbarTab === 'math' ? (
                        typeof s === 'string' ? (
                          <MathJax className="text-base pointer-events-none font-serif">{`$${s}$`}</MathJax>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <MathJax className="text-[10px] pointer-events-none scale-90 mb-0.5 font-serif">
                              {`$${s.value}$`}
                            </MathJax>
                            <span className="text-[8px] opacity-60 group-hover:opacity-100 truncate w-14 text-center font-sans">
                              {s.label.slice(0, 8)}
                            </span>
                          </div>
                        )
                      ) : (
                        typeof s === 'string' ? (
                          <span className="text-sm pointer-events-none font-sans font-medium text-foreground group-hover:text-primary transition-colors">{s}</span>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-0.5 w-full h-full">
                            <span className="text-sm pointer-events-none font-sans font-semibold text-foreground group-hover:text-primary transition-colors">{s.value}</span>
                            <span className="text-[8px] opacity-60 group-hover:opacity-100 truncate w-14 text-center font-sans scale-90">
                              {s.label}
                            </span>
                          </div>
                        )
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {Object.keys(filteredSymbols).length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching syntax found.
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col bg-background relative">
        {/* Top Bar for Preview Toggle */}
        <div className="p-2 border-b flex justify-between items-center px-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={downloadNoteAsPLX}
              className="gap-2 border-purple-500/20 text-purple-700 hover:bg-purple-50 hover:text-purple-800 transition-colors cursor-pointer h-8 text-xs font-semibold"
              title="Export and download the currently built note as a .plx note file"
            >
              <Download className="h-3.5 w-3.5" /> Export as .PLX
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              type="button"
              variant={isPreview ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setIsPreview(true)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button 
              type="button"
              variant={!isPreview ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setIsPreview(false)}
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" /> Edit
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pb-24">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <SortableBlock 
                  key={block.id} 
                  block={block} 
                  onUpdate={updateBlockContent}
                  onDelete={deleteBlock}
                  onFocus={(id, pos) => {
                    setActiveBlockId(id);
                    setCursorPos(pos);
                  }}
                  isPreview={isPreview}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Add Block Toolbar */}
        {!isPreview && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-background/90 backdrop-blur-md border shadow-2xl rounded-full z-50 transition-all duration-300">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full h-8 w-8 p-0 hover:bg-muted" 
              onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
              title={isToolbarCollapsed ? "Expand Toolbar" : "Collapse Toolbar"}
            >
              {isToolbarCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />}
            </Button>

            {!isToolbarCollapsed && <div className="w-px h-4 bg-border mx-0.5" />}

            {!isToolbarCollapsed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.9, width: 0 }}
                className="flex items-center gap-0.5 overflow-hidden h-9 px-0.5"
              >
                <div className="flex items-center">
                  <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2 px-2.5 h-8 hover:bg-muted" onClick={() => addBlock('h1')} title="Large Heading">
                    <Heading1 className="h-4 w-4" /> <span className="hidden lg:inline text-xs">H1</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2 px-2.5 h-8 hover:bg-muted" onClick={() => addBlock('h2')} title="Small Heading">
                    <Heading2 className="h-4 w-4" /> <span className="hidden lg:inline text-xs">H2</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2 px-2.5 h-8 hover:bg-muted" onClick={() => addBlock('text')} title="Body Text">
                    <Type className="h-4 w-4" /> <span className="hidden lg:inline text-xs">Text</span>
                  </Button>
                </div>

                <div className="w-px h-4 bg-border mx-0.5" />

                <div className="flex items-center">
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => addBlock('math')} title="Math Formula">
                    <Sigma className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => addBlock('diagram')} title="Image/Diagram">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => addBlock('bullet-list')} title="Bullet List">
                    <List className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => addBlock('numbered-list')} title="Numbered List">
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted text-primary" onClick={() => addBlock('question')} title="Add Question Card">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => setIsTableDialogOpen(true)} title="Data Table">
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="w-px h-4 bg-border mx-1" />
                
                <Button 
                  type="button" 
                  variant="default" 
                  size="sm" 
                  className="rounded-full gap-2 h-8 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 transition-transform shadow-md flex-shrink-0" 
                  onClick={() => setIsMagicDialogOpen(true)}
                >
                  <Wand2 className="h-3.5 w-3.5" /> <span className="text-[11px] font-medium">Magic Note</span>
                </Button>
                
                <div className="w-px h-4 bg-border mx-1" />
                
                <Button type="button" variant="default" size="sm" className="rounded-full h-8 w-8 p-0 flex-shrink-0 hover:rotate-90 transition-transform" onClick={() => addBlock('text')} title="Quick Add Text">
                  <Plus className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full h-8 px-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 animate-pulse" 
                  onClick={downloadPLXStandard}
                  title="Download PLX Standard (PLXS)"
                >
                  PLXS
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full h-8 px-2 text-[10px] font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-1" 
                  onClick={() => setIsAiPromptDialogOpen(true)}
                  title="Copy AI / DeepSeek Prompt Guide"
                >
                  <Sparkles className="h-3 w-3 text-purple-500" /> AI Prompt
                </Button>
              </motion.div>
            ) : (
              <div className="flex items-center gap-1 h-9 px-1">
                <Button 
                  type="button" 
                  variant="default" 
                  size="sm" 
                  className="rounded-full h-8 w-8 p-0 bg-gradient-to-br from-purple-600 to-pink-600 hover:shadow-lg transition-all hover:scale-110" 
                  onClick={() => setIsMagicDialogOpen(true)}
                  title="Magic Note Creator"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button type="button" variant="default" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-primary/90" onClick={() => addBlock('text')} title="Add Block">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {mode === 'edit' && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <span className="text-xs font-bold text-primary px-2">Update Note</span>
              </>
            )}
          </div>
        )}

        <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Insert Table</DialogTitle>
              <DialogDescription>
                Choose the dimensions for your new table.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rows" className="text-right text-xs">Rows</Label>
                <Input
                  id="rows"
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                  className="col-span-3 h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cols" className="text-right text-xs">Cols</Label>
                <Input
                  id="cols"
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                  className="col-span-3 h-8 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={addTable} className="text-xs h-8">Add Table</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isMagicDialogOpen} onOpenChange={setIsMagicDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-purple-500" />
                Magic Note Creator
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  Upload a <b>.plx</b> file (CoLearn Extensible Standard) to instantly build your note. 
                  You can also upload PDFs or images for AI-assisted note generation.
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] text-muted-foreground italic">AI Strategy:</span>
                  <button 
                    onClick={downloadPLXStandard}
                    className="text-[10px] text-amber-600 dark:text-amber-500 font-bold hover:underline cursor-pointer"
                  >
                    Download PLXS.txt
                  </button>
                  <span className="text-muted-foreground/30 text-[10px]">&bull;</span>
                  <button 
                    onClick={() => setIsAiPromptDialogOpen(true)}
                    className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <Sparkles className="h-3 w-3 inline" /> Copy DeepSeek Prompt
                  </button>
                </div>
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-8">
              {!isMagicLoading ? (
                <div 
                  className="border-2 border-dashed border-muted-foreground/20 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">.plx, PDF, Image or TXP (Max 50MB)</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".plx,text/plain,application/pdf,image/*"
                    onChange={handleMagicUpload}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                    <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-500 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium">Hermes is reading your document...</p>
                    <p className="text-xs text-muted-foreground animate-pulse">This might take a minute for complex files</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-start">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-lg w-full">
                <FileText className="h-3 w-3" />
                <span>PLX files are parsed instantly. AI handles PDFs and Image extractions.</span>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAiPromptDialogOpen} onOpenChange={setIsAiPromptDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                <span>DeepSeek Accent Writing Guide & Prompt</span>
              </DialogTitle>
              <DialogDescription className="text-xs pt-1 leading-normal font-sans">
                External AIs like <strong>DeepSeek, ChatGPT, or Claude</strong> often struggle with Yoruba or Igbo tone combined subdots (e.g., <code className="bg-muted px-1 rounded font-mono">ọ́</code> or <code className="bg-muted px-1 rounded font-mono">ẹ̀</code>) and output corrupted text. 
                <br /><br />
                Copy this specialized <strong>System Prompt</strong>. It teaches the AI our standardized PLX representation and our <strong>Lossless keyboard shorthand codes</strong> (which are automatically compiled upon uploading or button-pressing) to guarantee pristine accents.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto my-3 border rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs select-all whitespace-pre-wrap leading-relaxed relative group">
              <button
                onClick={copyPromptToClipboard}
                className="absolute right-3 top-3 bg-slate-800 hover:bg-slate-700/80 p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                title="Copy prompt text to clipboard"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-[10px] font-bold text-green-400 font-sans">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium font-sans">Copy</span>
                  </>
                )}
              </button>
              {DEEPSEEK_PROMPT_GUIDE}
            </div>

            <DialogFooter className="flex sm:justify-between items-center border-t pt-3.5 gap-2">
              <button
                onClick={downloadPLXStandard}
                className="text-xs text-amber-600 dark:text-amber-500 font-bold hover:underline cursor-pointer"
                type="button"
              >
                Download full PLXS.txt guide
              </button>
              <Button type="button" onClick={() => setIsAiPromptDialogOpen(false)} className="text-xs h-9 cursor-pointer">
                Done, copied!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};