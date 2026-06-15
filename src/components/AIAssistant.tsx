
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bird, Send, X, Loader2, MinusCircle, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { chatWithHermes, ChatMessage } from '../services/aiService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AIConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import remarkGfm from 'remark-gfm';

interface AIAssistantProps {
  noteContent: string;
  noteTitle: string;
}

export function AIAssistant({ noteContent, noteTitle }: AIAssistantProps) {
  const { profile } = useAuth();
  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'hermes'), (snapshot) => {
      if (snapshot.exists()) {
        setAiConfig(snapshot.data() as AIConfig);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithHermes([...messages, userMessage], noteContent, aiConfig || undefined);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnactivatedStudent) return null;

  if (aiConfig && aiConfig.isActive === false) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '60px' : '500px',
              width: '350px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="shadow-2xl rounded-2xl overflow-hidden border bg-background flex flex-col"
          >
            <Card className="border-none shadow-none h-full flex flex-col rounded-none">
              <CardHeader className="p-4 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bird className="h-4 w-4" />
                  Hermes - {noteTitle}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    {isMinimized ? <Maximize2 className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              {!isMinimized && (
                <>
                  <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                    <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
                      {messages.length === 0 && (
                        <div className="text-center py-8 px-4 space-y-2">
                          <Bird className="h-10 w-10 mx-auto text-primary opacity-20" />
                          <p className="text-sm text-muted-foreground">
                            Hello! I'm Hermes. Ask me anything about your note on <span className="font-semibold text-primary">"{noteTitle}"</span>.
                          </p>
                        </div>
                      )}
                      <div className="space-y-4">
                        {messages.map((m, i) => (
                          <div
                            key={i}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                m.role === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-muted rounded-tl-none'
                              }`}
                            >
                              <div className="markdown-body prose dark:prose-invert prose-sm max-w-none">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkMath, remarkGfm]} 
                                  rehypePlugins={[rehypeMathjax]}
                                >
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-2xl rounded-tl-none px-3 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-3 border-t bg-background">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSend();
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="Ask Hermes..."
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          className="rounded-full bg-muted border-none h-9 text-sm focus-visible:ring-1"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          className="rounded-full h-9 w-9 shrink-0 cursor-pointer"
                          disabled={!input.trim() || isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg ring-4 ring-primary/20"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
        >
          <Bird className="h-7 w-7" />
        </Button>
      </motion.div>
    </div>
  );
}
