import { useEffect } from 'react';

export function useTitle(title?: string) {
  useEffect(() => {
    const baseTitle = 'PANTHEON';
    document.title = title ? `${baseTitle} | ${title}` : baseTitle;
    
    return () => {
      document.title = baseTitle;
    };
  }, [title]);
}
