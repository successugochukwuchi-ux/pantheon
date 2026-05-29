import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface SafeMathRendererProps {
  math: string;
  block?: boolean;
}

export const SafeMathRenderer: React.FC<SafeMathRendererProps> = ({ math, block = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Clean any potential outer double/single dollar signs because we handle block mode explicitly
        const content = math.trim().replace(/^\$\$?/, '').replace(/\$\$?$/, '');
        katex.render(content, containerRef.current, {
          displayMode: block,
          throwOnError: false,
          trust: true,
        });
      } catch (err) {
        console.error('KaTeX error:', err);
        containerRef.current.textContent = math;
      }
    }
  }, [math, block]);

  return (
    <span 
      ref={containerRef} 
      className={block ? "block w-full text-center overflow-x-auto my-2" : "inline-block"} 
    />
  );
};

export const prepareMarkdownMath = (text: string): string => {
  if (!text) return '';
  
  let processed = text;
  // Convert standard \\( and \\) or \( and \) to $...$
  processed = processed.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  // Convert standard \\[ and \\] or \[ and \] to $$...$$
  processed = processed.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  
  // 1. Process block math $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, mathContent) => {
    const escapedMath = mathContent.replace(/\\{2}/g, '\\\\');
    return `$$${escapedMath}$$`;
  });
  
  // 2. Process inline math $...$
  processed = processed.replace(/(?<!\\)\$((?:\\\$|[^$])+?)\$/g, (match, mathContent) => {
    const escapedMath = mathContent.replace(/\\{2}/g, '\\\\');
    return `$${escapedMath}$`;
  });
  
  return processed;
};
