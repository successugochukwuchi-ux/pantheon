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

export const MathMarkdown: React.FC<MathMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const prepared = prepareMarkdownMath(content);

  return (
    <div className={`prose dark:prose-invert max-w-none text-current inline-block ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
        components={{
          p: ({ children }) => <span className="inline leading-relaxed">{children}</span>,
          div: ({ children }) => <div className="leading-relaxed">{children}</div>,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
};
