
import { AIConfig } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const GROQ_API_KEY = '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';
const OPENROUTER_API_KEY = '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';

export async function chatWithHermes(messages: ChatMessage[], noteContent: string, config?: AIConfig) {
  const provider = config?.provider || 'groq';
  const model = config?.model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'google/gemini-2.0-flash-001');
  const apiKey = config?.apiKey || (provider === 'groq' ? GROQ_API_KEY : OPENROUTER_API_KEY);

  const baseUrl = provider === 'groq' 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://openrouter.ai/api/v1/chat/completions';

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

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Hermes Academic Assistant';
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: [systemPrompt, ...messages],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Failed to connect to Hermes via ${provider}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}
