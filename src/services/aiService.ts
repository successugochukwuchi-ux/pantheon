
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const GROQ_API_KEY = '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';

export async function chatWithHermes(messages: ChatMessage[], noteContent: string) {
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are Hermes, a helpful academic assistant. 
    STRATEGIC DIRECTIVES:
    1. Answer strictly based on the provided NOTE CONTENT.
    2. If a question is unrelated to the notes, politely decline.
    3. Use LaTeX for ALL mathematical formulas or scientific notations (e.g., $E=mc^2$ or $\frac{a}{b}$).
    4. Keep responses concise and focused to ensure fast response times.
    
    NOTE CONTENT:
    ${noteContent}
    `
  };

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [systemPrompt, ...messages],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to connect to Hermes via Groq');
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}
