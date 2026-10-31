import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { prepareMarkdownMath } from './SafeMathRenderer';

interface MathMarkdownProps {
  content: string;
  className?: string;
}

export const customPlxComponents: Record<string, React.ComponentType<any>> = {
  p: ({ children }) => <span className="inline leading-relaxed">{children}</span>,
  div: ({ children }) => <div className="leading-relaxed">{children}</div>,
  plx: ({ children }) => <div className="plx-root space-y-4 my-2 w-full">{children}</div>,
  text: ({ children }) => <div className="my-2 leading-relaxed text-slate-800 dark:text-slate-200">{children}</div>,
  list: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1.5 text-slate-800 dark:text-slate-200">{children}</ul>,
  ordered: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 text-slate-800 dark:text-slate-200">{children}</ol>,
  diagram: ({ children }) => (
    <div className="my-3 p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner">
      {children}
    </div>
  ),
  table_data: ({ children }) => <div className="overflow-x-auto my-4">{children}</div>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
      <table className="w-full text-left border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold border-b border-slate-200 dark:border-slate-700">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="p-3 border-r border-slate-200 dark:border-slate-700 last:border-r-0 font-bold">{children}</th>,
  td: ({ children }) => <td className="p-3 border-r border-slate-200 dark:border-slate-700 last:border-r-0">{children}</td>,
  ques: ({ children }) => (
    <div className="my-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20">
      {children}
    </div>
  ),
  question: ({ children }) => (
    <div className="my-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20">
      {children}
    </div>
  ),
  inc: ({ children }) => (
    <div className="my-1.5 p-2.5 px-3.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
      <div>{children}</div>
    </div>
  ),
  exp: ({ children }) => (
    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200/50 dark:border-amber-900/30">
      {children}
    </div>
  ),
  cor: ({ children }) => (
    <div className="my-1.5 p-2.5 px-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2 font-medium">
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      <div>{children}</div>
    </div>
  ),
  math: ({ children }) => <span className="katex-math inline-block">{children}</span>,
  semantics: ({ children }) => <span className="katex-semantics inline">{children}</span>,
  mrow: ({ children }) => <span className="katex-mrow inline">{children}</span>,
  mfrac: ({ children }) => <span className="katex-mfrac inline-block text-center">{children}</span>,
  msup: ({ children }) => <span className="katex-msup inline">{children}</span>,
  msub: ({ children }) => <span className="katex-msub inline">{children}</span>,
  mi: ({ children }) => <span className="katex-mi inline font-serif italic">{children}</span>,
  mo: ({ children }) => <span className="katex-mo inline px-0.5">{children}</span>,
  mn: ({ children }) => <span className="katex-mn inline font-sans">{children}</span>,
  annotation: () => null,
  annotation_xml: () => null,
  'annotation-xml': () => null,
  video: ({ children }) => <div className="my-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-indigo-600 dark:text-indigo-400">{children}</div>,
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-200 dark:border-slate-800">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-2 text-slate-900 dark:text-slate-100">{children}</h2>,
  b: ({ children }) => <strong className="font-semibold">{children}</strong>,
  i: ({ children }) => <em className="italic">{children}</em>,
  u: ({ children }) => <u className="underline decoration-1 underline-offset-2">{children}</u>,
};

export const MathMarkdown: React.FC<MathMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const prepared = prepareMarkdownMath(content);

  return (
    <div className={`prose dark:prose-invert max-w-none text-current inline-block ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'html', throwOnError: false, strict: false, errorColor: 'inherit' }]]}
        components={customPlxComponents}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
};
