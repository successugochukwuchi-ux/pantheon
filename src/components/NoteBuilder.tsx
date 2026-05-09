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
  List,
  ListOrdered,
  Settings2,
  PenTool
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card } from './ui/card';
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
import { magicNoteCreator } from '../services/aiService';
import { toast } from 'sonner';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AIConfig } from '../types';

export type BlockType = 'text' | 'math' | 'h1' | 'h2' | 'diagram' | 'table' | 'video' | 'bullet-list' | 'numbered-list';

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
              {block.content}
            </ReactMarkdown>
          </h1>
        )}
        {block.type === 'h2' && (
          <h2 className="text-2xl font-bold mb-3">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {block.content}
            </ReactMarkdown>
          </h2>
        )}
        {block.type === 'text' && (
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {block.content}
            </ReactMarkdown>
          </div>
        )}
        {block.type === 'math' && block.content && (
          <div className="py-4 flex justify-center bg-muted/30 rounded-lg overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {(() => {
                const content = block.content.trim().replace(/^\$\$?/, '').replace(/\$\$?$/, '');
                return `$$${content}$$`;
              })()}
            </ReactMarkdown>
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
                              {cell}
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
          <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-white/5 my-4">
            <iframe
              src={block.content.includes('youtube.com') || block.content.includes('youtu.be') 
                ? `https://www.youtube.com/embed/${block.content.split('/').pop()?.split('v=').pop()?.split('&')[0]}`
                : block.content}
              className="w-full h-full"
              allowFullScreen
              title="Step Video"
            />
          </div>
        )}
        {(block.type === 'bullet-list' || block.type === 'numbered-list') && (
          <div className="prose dark:prose-invert max-w-none my-6">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {block.content}
            </ReactMarkdown>
          </div>
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
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {(() => {
                    const content = block.content.trim().replace(/^\$\$?/, '').replace(/\$\$?$/, '');
                    return `$$${content}$$`;
                  })()}
                </ReactMarkdown>
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
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-muted/10 border border-white/5 flex items-center justify-center">
                <iframe
                  src={block.content.includes('youtube.com') || block.content.includes('youtu.be') 
                    ? `https://www.youtube.com/embed/${block.content.split('/').pop()?.split('v=').pop()?.split('&')[0]}`
                    : block.content}
                  className="w-full h-full border-none"
                  allowFullScreen
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
  const [cursorPos, setCursorPos] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isMagicDialogOpen, setIsMagicDialogOpen] = useState(false);
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
    Chemistry: true
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
        // ── PLX / TEXT: Parse standard format ───────────────────────────────
        const text = await file.text();
        const plxRegex = /\[(H1|H2|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM)\]/g;
        
        if (plxRegex.test(text)) {
          toast.loading('Parsing PLX note...', { id: 'plx-status' });
          const parts = text.split(/\[(H1|H2|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM)\]/g);
          
          if (parts[0].trim()) {
            resultBlocks.push({ type: 'text', content: parts[0].trim() });
          }
          
          for (let i = 1; i < parts.length; i += 2) {
            const tagName = parts[i];
            const content = parts[i+1]?.trim() || '';
            const typeMap: Record<string, string> = {
              'H1': 'h1',
              'H2': 'h2',
              'MATH': 'math',
              'LIST': 'bullet-list',
              'ORDERED': 'numbered-list',
              'TABLE': 'table',
              'VIDEO': 'video',
              'DIAGRAM': 'diagram'
            };
            resultBlocks.push({ type: typeMap[tagName] || 'text', content });
          }
          toast.dismiss('plx-status');
        } else if (fileExtension === 'plx') {
          throw new Error('Invalid PLX format. No standard tags ([H1], [MATH], etc.) found.');
        } else {
          // Plain text but not PLX, handle as before or just as a single block?
          // For now, let's treat it as a text block
          resultBlocks = [{ type: 'text', content: text }];
        }

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

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Filtered symbols for search
  const filteredSymbols = Object.entries(MATH_SYMBOLS).reduce((acc, [category, data]) => {
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
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Sigma className="h-4 w-4" /> Syntax Toolbar
          </h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search syntax..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              className="pl-9 h-9 text-xs bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.entries(filteredSymbols).map(([category, data]) => (
            <div key={category} className="space-y-1">
              <button 
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-lg text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
                      className="h-10 w-full p-0 text-sm font-serif flex flex-col items-center justify-center hover:bg-primary/10 hover:text-primary transition-all group"
                      onClick={() => insertSymbol(typeof s === 'string' ? s : s.value)}
                      title={typeof s === 'string' ? s : `${s.label}: ${s.value}`}
                    >
                      {typeof s === 'string' ? (
                        <MathJax className="text-base pointer-events-none">{`$${s}$`}</MathJax>
                      ) : (
                        <div className="flex flex-col items-center">
                          <MathJax className="text-[10px] pointer-events-none scale-90 mb-0.5">
                            {`$${s.value}$`}
                          </MathJax>
                          <span className="text-[8px] opacity-60 group-hover:opacity-100 truncate w-14 text-center">
                            {s.label.slice(0, 8)}
                          </span>
                        </div>
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
        <div className="p-2 border-b flex justify-end gap-2 bg-muted/10">
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
              <DialogDescription>
                Upload a <b>.plx</b> file (Pantheon Extensible Standard) to instantly build your note. 
                You can also upload PDFs or images for AI-assisted note generation.
                <br />
                <a href="/plx" target="_blank" className="text-amber-600 underline font-medium mt-1 inline-block">
                  View .plx Standard Guide
                </a>
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
      </div>
    </div>
  );
};