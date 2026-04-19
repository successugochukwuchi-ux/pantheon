import React, { useState, useCallback, useRef } from 'react';
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
  Image as ImageIcon,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Eye,
  Edit3,
  Search,
  FlaskConical,
  Zap,
  Variable
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { MathJax } from 'better-react-mathjax';
import { Rnd } from 'react-rnd';
import { cn } from '../lib/utils';

export type BlockType = 'text' | 'math' | 'h1' | 'h2' | 'diagram';

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
        {block.type === 'h1' && <h1 className="text-3xl font-bold mb-4">{block.content}</h1>}
        {block.type === 'h2' && <h2 className="text-2xl font-bold mb-3">{block.content}</h2>}
        {block.type === 'text' && (
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
            {block.content}
          </div>
        )}
        {block.type === 'math' && block.content && (
          <div className="py-4 flex justify-center bg-muted/30 rounded-lg overflow-x-auto">
            <MathJax>{`$$${block.content}$$`}</MathJax>
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
            placeholder="Start typing your notes..."
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
                <MathJax>{`$$${block.content}$$`}</MathJax>
              </div>
            )}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Mathematics: true,
    Physics: true,
    Chemistry: true
  });

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

  const insertSymbol = (symbol: string) => {
    if (!activeBlockId) return;
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block || (block.type !== 'text' && block.type !== 'math')) return;

    const newContent = block.content.slice(0, cursorPos) + symbol + block.content.slice(cursorPos);
    updateBlockContent(activeBlockId, newContent);
    setCursorPos(cursorPos + symbol.length);
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-background border shadow-xl rounded-full z-20">
            <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('h1')}>
              <Heading1 className="h-4 w-4" /> H1
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('h2')}>
              <Heading2 className="h-4 w-4" /> H2
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('text')}>
              <Type className="h-4 w-4" /> Text
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('math')}>
              <Sigma className="h-4 w-4" /> Math
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('diagram')}>
              <ImageIcon className="h-4 w-4" /> Diagram
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button type="button" variant="default" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => addBlock('text')}>
              <Plus className="h-4 w-4" />
            </Button>
            {mode === 'edit' && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <span className="text-xs font-bold text-primary px-2">Update Note</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
