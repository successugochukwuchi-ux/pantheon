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
  Edit3
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card } from './ui/card';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
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

const MATH_SYMBOLS = {
  Basic: ['+', '-', '*', '/', '=', '≠', '<', '>', '≤', '≥', '±', '∞'],
  Greek: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ω', 'Δ', 'Ω'],
  Calculus: ['∫', '∬', '∂', '∇', '∑', '∏', '√', '∛', 'lim', '→'],
  Functions: ['sin', 'cos', 'tan', 'log', 'ln', 'exp'],
  LaTeX: [
    { label: 'Fraction', value: '\\frac{a}{b}' },
    { label: 'Power', value: 'x^{n}' },
    { label: 'Subscript', value: 'x_{i}' },
    { label: 'Square Root', value: '\\sqrt{x}' },
    { label: 'Integral', value: '\\int_{a}^{b} f(x) dx' },
    { label: 'Sum', value: '\\sum_{i=1}^{n}' },
    { label: 'Matrix', value: '\\begin{matrix} a & b \\\\ c & d \\end{matrix}' }
  ]
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
            <BlockMath math={block.content} />
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
                <BlockMath math={block.content} />
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
                  bounds="parent"
                  lockAspectRatio={block.settings?.aspectRatio}
                  className="relative group/rnd"
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
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-background border shadow-lg rounded-lg p-1 opacity-0 group-hover/rnd:opacity-100 transition-opacity z-50">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => onUpdate(block.id, block.content, { ...block.settings, flipX: !block.settings?.flipX })}
                      >
                        <FlipHorizontal className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => onUpdate(block.id, block.content, { ...block.settings, flipY: !block.settings?.flipY })}
                      >
                        <FlipVertical className="h-3 w-3" />
                      </Button>
                      <Button 
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
}

export const NoteBuilder: React.FC<NoteBuilderProps> = ({ initialContent, onChange }) => {
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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Basic: true,
    Greek: true,
    LaTeX: true
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

  return (
    <div className="flex h-[700px] border rounded-xl overflow-hidden bg-background">
      {/* Left Toolbar */}
      <div className="w-64 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b bg-background flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Sigma className="h-4 w-4" /> Math Toolbar
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.entries(MATH_SYMBOLS).map(([category, symbols]) => (
            <div key={category} className="space-y-1">
              <button 
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-lg text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {category}
                {expandedCategories[category] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {expandedCategories[category] && (
                <div className="grid grid-cols-4 gap-1 p-1">
                  {symbols.map((s, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-sm font-serif"
                      onClick={() => insertSymbol(typeof s === 'string' ? s : s.value)}
                      title={typeof s === 'string' ? s : s.label}
                    >
                      {typeof s === 'string' ? s : (
                        <span className="text-[10px] scale-90">{s.label.slice(0, 3)}</span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col bg-background relative">
        {/* Top Bar for Preview Toggle */}
        <div className="p-2 border-b flex justify-end gap-2 bg-muted/10">
          <Button 
            variant={isPreview ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setIsPreview(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button 
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
            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('h1')}>
              <Heading1 className="h-4 w-4" /> H1
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('h2')}>
              <Heading2 className="h-4 w-4" /> H2
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('text')}>
              <Type className="h-4 w-4" /> Text
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('math')}>
              <Sigma className="h-4 w-4" /> Math
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full gap-2" onClick={() => addBlock('diagram')}>
              <ImageIcon className="h-4 w-4" /> Diagram
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="default" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => addBlock('text')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
