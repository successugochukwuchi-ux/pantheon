/**
 * Utility functions to extract text and search notes across title and content blocks.
 */

export function extractTextFromNoteContent(content: string | undefined | null): string {
  if (!content) return '';
  try {
    const blocks = JSON.parse(content);
    if (Array.isArray(blocks)) {
      return blocks
        .map((b: any) => {
          if (!b) return '';
          if (typeof b.content === 'string') return b.content;
          if (b.type === 'quiz' && b.question) return `${b.question} ${Array.isArray(b.options) ? b.options.join(' ') : ''}`;
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
  } catch {
    // raw markdown/plain string
  }
  return content;
}

export interface NoteSearchResult {
  matches: boolean;
  snippet?: string;
  matchType?: 'title' | 'content' | 'both';
}

export function searchNote(
  note: { title: string; content: string },
  searchQuery: string
): NoteSearchResult {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q) {
    return { matches: true };
  }

  const titleLower = (note.title || '').toLowerCase();
  const titleMatches = titleLower.includes(q);

  const plainText = extractTextFromNoteContent(note.content);
  const plainTextLower = plainText.toLowerCase();
  const contentMatchIndex = plainTextLower.indexOf(q);
  const contentMatches = contentMatchIndex !== -1;

  if (!titleMatches && !contentMatches) {
    return { matches: false };
  }

  let snippet = '';
  if (contentMatches) {
    const start = Math.max(0, contentMatchIndex - 50);
    const end = Math.min(plainText.length, contentMatchIndex + q.length + 70);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < plainText.length ? '...' : '';
    snippet = prefix + plainText.substring(start, end).replace(/\s+/g, ' ').trim() + suffix;
  } else if (titleMatches) {
    snippet = `Matched in title: "${note.title}"`;
  }

  return {
    matches: true,
    snippet,
    matchType: titleMatches && contentMatches ? 'both' : titleMatches ? 'title' : 'content'
  };
}
