
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bird, Send, X, Loader2, MinusCircle, Maximize2, Mic, MicOff, Volume2, VolumeX, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { chatWithHermes, ChatMessage } from '../services/aiService';
import { HermesDiagnosticCard } from './HermesDiagnosticCard';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AIConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { speakText, stopSpeech } from '../lib/ttsService';
import { toast } from 'sonner';
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isHoldingRef = useRef(false);
  const holdTranscriptRef = useRef('');
  const lastUserMsgRef = useRef<string>('');

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
  }, [messages, isLoading, recordingTranscript]);

  // Clean up speech and recognition on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Barge-in: user interruption immediately cuts off any active speech
  const interruptSpeech = useCallback(() => {
    stopSpeech();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const handleSend = async (overrideText?: string, isVoice = false) => {
    const textToSend = (overrideText !== undefined ? overrideText : input).trim();
    if (!textToSend || isLoading) return;

    // Interrupt any ongoing speech
    interruptSpeech();

    lastUserMsgRef.current = textToSend;
    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    if (overrideText === undefined) {
      setInput('');
    }
    setIsLoading(true);

    try {
      const response = await chatWithHermes([...messages, userMessage], noteContent, aiConfig || undefined, isVoice);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);

      // Speak response if voice is enabled or user spoke with hold-to-speak
      if (voiceEnabled || isVoice) {
        setIsSpeaking(true);
        speakText(response, {
          onStart: () => setIsSpeaking(true),
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        }).catch(() => setIsSpeaking(false));
      }
    } catch (error: any) {
      const diag = error?.diagnostics;
      const raw = error?.message || 'Failed to connect to Hermes.';
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: raw,
          diagnostics: diag,
          isError: true,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);

  // Stop recording and send text
  const stopRecordingAndSend = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const finalSpokenText = holdTranscriptRef.current.trim();
    setRecordingTranscript('');

    if (finalSpokenText) {
      handleSend(finalSpokenText, true);
    }
  }, [handleSend]);

  // Start speech recognition for Tap-to-Talk
  const startRecording = useCallback(() => {
    // 1. Instant barge-in interruption of any active speech
    interruptSpeech();

    isRecordingRef.current = true;
    holdTranscriptRef.current = '';
    setRecordingTranscript('');
    setIsRecording(true);

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        holdTranscriptRef.current = currentTranscript;
        setRecordingTranscript(currentTranscript);

        // Reset silence timer whenever words are spoken: auto-send after 2.5s of silence
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current && holdTranscriptRef.current.trim()) {
            stopRecordingAndSend();
          }
        }, 2500);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition warning/error:', event.error);
        // 'no-speech' is expected when user pauses; do NOT kill recording!
        if (event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access.');
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // If recording is still supposed to be active, restart seamlessly to prevent premature cutoff
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch {}
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [interruptSpeech, stopRecordingAndSend]);

  // Toggle Tap-To-Talk: Tap to start listening, tap again to finish and send
  const toggleTapToTalk = () => {
    if (isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
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
              height: isMinimized ? '60px' : '560px',
              width: isMinimized ? '320px' : '400px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="shadow-2xl rounded-2xl overflow-hidden border bg-background flex flex-col max-w-[calc(100vw-24px)]"
          >
            <Card className="border-none shadow-none h-full flex flex-col rounded-none">
              <CardHeader className="p-4 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bird className="h-4 w-4" />
                  Hermes - {noteTitle}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {/* Toggle Voice Output */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                    title={voiceEnabled ? "Mute Voice Output" : "Enable Voice Output"}
                    onClick={() => {
                      if (isSpeaking) interruptSpeech();
                      setVoiceEnabled(!voiceEnabled);
                    }}
                  >
                    {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-60" />}
                  </Button>
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
                    onClick={() => {
                      interruptSpeech();
                      setIsOpen(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              {!isMinimized && (
                <>
                  <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                    {/* Active Speech Bar / Interruption Banner */}
                    {isSpeaking && (
                      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 py-1.5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="font-medium">Hermes is speaking</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={interruptSpeech}
                          className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                        >
                          <Square className="h-3 w-3 mr-1 fill-current" />
                          Interrupt
                        </Button>
                      </div>
                    )}

                    {/* Messages Container */}
                    <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
                      {messages.length === 0 && (
                        <div className="text-center py-8 px-4 space-y-2">
                          <Bird className="h-10 w-10 mx-auto text-primary opacity-20" />
                          <p className="text-sm text-muted-foreground">
                            Hello! I'm Hermes. Ask me anything about your note on <span className="font-semibold text-primary">"{noteTitle}"</span>.
                          </p>
                          <p className="text-xs text-muted-foreground/75">
                            Hold the mic button below to talk with me directly.
                          </p>
                        </div>
                      )}
                      <div className="space-y-4">
                        {messages.map((m, i) => (
                          <div
                            key={i}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {m.isError || m.diagnostics ? (
                              <div className="w-full max-w-[96%]">
                                <HermesDiagnosticCard
                                  diagnostics={m.diagnostics}
                                  errorMessage={m.content}
                                  onRetry={() => {
                                    if (lastUserMsgRef.current) {
                                      handleSend(lastUserMsgRef.current);
                                    }
                                  }}
                                  aiConfig={aiConfig}
                                />
                              </div>
                            ) : m.role === 'user' ? (
                              <div className="max-w-[85%] rounded-2xl rounded-tr-none px-4 py-2.5 text-sm bg-primary shadow-sm border border-primary/20 select-text">
                                <p className="text-white font-medium text-sm leading-relaxed whitespace-pre-wrap break-words m-0 p-0">
                                  {m.content}
                                </p>
                              </div>
                            ) : (
                              <div className="max-w-[88%] rounded-2xl rounded-tl-none px-3.5 py-2.5 text-sm bg-muted text-foreground">
                                <div className="markdown-body prose dark:prose-invert prose-sm max-w-none">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkMath, remarkGfm]} 
                                    rehypePlugins={[rehypeMathjax]}
                                  >
                                    {m.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">Hermes is thinking...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recording indicator overlay */}
                    {isRecording && (
                      <div className="px-3 py-2 bg-primary/10 border-t border-primary/20 flex items-center justify-between text-xs text-primary animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                          <span className="font-medium">
                            {recordingTranscript ? `"${recordingTranscript}"` : 'Listening... Speak now'}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold">Tap mic to send</span>
                      </div>
                    )}
                    
                    {/* Bottom Control / Input Form */}
                    <div className="p-3 border-t bg-background">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSend();
                        }}
                        className="flex items-center gap-2"
                      >
                        {/* Tap-To-Talk Button */}
                        <Button
                          type="button"
                          variant={isRecording ? "destructive" : "secondary"}
                          size="icon"
                          onClick={toggleTapToTalk}
                          className={`rounded-full h-9 w-9 shrink-0 transition-transform select-none ${
                            isRecording ? 'scale-110 ring-4 ring-destructive/25' : 'hover:bg-primary hover:text-primary-foreground'
                          }`}
                          title={isRecording ? "Tap to finish and send" : "Tap to Speak"}
                        >
                          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>

                        <Input
                          placeholder={isRecording ? "Listening... Speak now" : "Ask Hermes or tap mic to speak..."}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          className="rounded-full bg-muted border-none h-9 text-sm focus-visible:ring-1 flex-1"
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
            if (isOpen) {
              interruptSpeech();
              setIsOpen(false);
            } else {
              setIsOpen(true);
              setIsMinimized(false);
            }
          }}
          aria-label={isOpen ? "Close Hermes Assistant" : "Open Hermes Assistant"}
        >
          <Bird className="h-7 w-7" />
        </Button>
      </motion.div>
    </div>
  );
}
