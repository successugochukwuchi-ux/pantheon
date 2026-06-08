import { useEffect } from 'react';

export function useTitle(title?: string) {
  useEffect(() => {
    const baseTitle = 'COLEARN';
    document.title = title ? `${baseTitle} | ${title}` : baseTitle;
    
    return () => {
      document.title = baseTitle;
    };
  }, [title]);
}
