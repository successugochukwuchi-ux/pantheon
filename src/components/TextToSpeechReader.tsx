import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Settings2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech, getDefaultVoice, setDefaultVoice, unlockAudioContext, MICROSOFT_VOICES, convertLatexToSpeakable, stripDiagramsAndCleanForTTS } from '../lib/ttsService';

export { convertLatexToSpeakable };

interface TextToSpeechReaderProps {
  noteContent: string;
  noteTitle: string;
}

export function getVoiceLabel(voice: SpeechSynthesisVoice): string {
  const name = voice.name;
  const lang = voice.lang;
  
  // Extract locale
  let locale = 'US';
  if (lang.startsWith('en-GB') || name.includes('Great Britain') || name.includes('UK')) locale = 'UK';
  else if (lang.startsWith('en-AU') || name.includes('Australia')) locale = 'AU';
  else if (lang.startsWith('en-IN') || name.includes('India')) locale = 'IN';
  else if (lang.startsWith('en-CA') || name.includes('Canada')) locale = 'CA';
  else if (lang.startsWith('en-US') || name.includes('United States')) locale = 'US';
  else if (lang.startsWith('en-ZA') || name.includes('South Africa')) locale = 'ZA';
  else if (lang.startsWith('en-NZ') || name.includes('New Zealand')) locale = 'NZ';
  else if (lang.startsWith('en-IE') || name.includes('Ireland')) locale = 'IE';
  else locale = lang.split('-')[1]?.toUpperCase() || 'EN';

  // Determine quality / source
  let quality = 'Standard';
  let prefix = '🗣️';
  if (name.includes('Google') || name.includes('Natural') || name.includes('Premium') || name.includes('Neural') || name.includes('Samantha') || name.includes('Daniel') || name.includes('Arthur')) {
    quality = 'Natural';
    prefix = '✨';
  }

  // Determine gender
  let gender = '';
  const lowerName = name.toLowerCase();
  if (lowerName.includes('female') || lowerName.includes('zira') || lowerName.includes('samantha') || lowerName.includes('hazel') || lowerName.includes('susan') || lowerName.includes('karen') || lowerName.includes('moira') || lowerName.includes('tessa') || lowerName.includes('veena') || lowerName.includes('fiona')) {
    gender = ' - Female';
  } else if (lowerName.includes('male') || lowerName.includes('david') || lowerName.includes('mark') || lowerName.includes('george') || lowerName.includes('daniel') || lowerName.includes('alex') || lowerName.includes('fred') || lowerName.includes('rishi') || lowerName.includes('ravi')) {
    gender = ' - Male';
  }

  // Clean name representation
  let cleanName = name
    .replace(/Microsoft|Desktop|Natural|Voice|Google|Apple|Premium|Synthetic/gi, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();
  
  if (!cleanName) cleanName = 'System Voice';

  return `${prefix} English (${locale})${gender} (${cleanName}) [${quality}]`;
}

export function TextToSpeechReader({ noteContent, noteTitle }: TextToSpeechReaderProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingProgress, setPreparingProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-AriaNeural');
  const [showSettings, setShowSettings] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const cleanTextRef = useRef<string>('');

  // Extract clean speakable text from Note blocks
  useEffect(() => {
    try {
      const blocks = JSON.parse(noteContent);
      if (Array.isArray(blocks)) {
        const rawFullTextParts = blocks
          .map((b: any) => {
            if (!b) return '';
            const type = b.type || '';
            if (type === 'h1' || type === 'h2' || type === 'h3' || type === 'h4' || type === 'text' || type === 'paragraph' || type === 'callout' || type === 'quote') {
              return b.content || '';
            }
            if (type === 'math' && b.content) {
              const cleaned = b.content.trim();
              if (cleaned.startsWith('$')) return cleaned;
              return `$$${cleaned}$$`;
            }
            if (type === 'table' && b.content) {
              try {
                const rows = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
                if (Array.isArray(rows)) {
                  return "Table content: " + rows.map((r: any) => Array.isArray(r) ? r.join(', ') : String(r)).join('. ');
                }
              } catch {
                return b.content || '';
              }
            }
            if (type === 'diagram' || type === 'image') {
              const caption = b.settings?.caption || b.settings?.description || b.settings?.alt || '';
              if (caption.trim()) {
                return `Diagram showing: ${caption.trim()}`;
              }
              return '';
            }
            if (type === 'bullet-list' || type === 'numbered-list' || type === 'list') {
              return b.content || '';
            }
            if (type === 'question' && b.content) {
              try {
                const q = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
                return `Question: ${q.question || ''}. Correct answer: ${q.correct || ''}.`;
              } catch {
                return '';
              }
            }
            if (typeof b.content === 'string' && !b.content.startsWith('http') && !b.content.startsWith('data:')) {
              return b.content;
            }
            return '';
          })
          .filter(Boolean);

        let joined = rawFullTextParts.join('... ');
        // Strip base64, SVG XML and raw HTML tags
        joined = joined.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
        joined = joined.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, '');
        joined = joined.replace(/<svg[\s\S]*?<\/svg>/gi, '');
        joined = joined.replace(/<[^>]*>/g, '');

        if (!joined.trim()) {
          joined = `${noteTitle || 'Study Note'}.`;
        }
        cleanTextRef.current = convertLatexToSpeakable(joined);
      } else {
        let rawText = noteContent || noteTitle;
        rawText = rawText.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
        rawText = rawText.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, '');
        rawText = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, '');
        rawText = rawText.replace(/<[^>]*>/g, '');
        cleanTextRef.current = convertLatexToSpeakable(rawText);
      }
    } catch {
      // Fallback for markdown notes
      let rawText = noteContent || noteTitle;
      // Strip raw base64 data strings (very large continuous blocks of characters)
      rawText = rawText.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
      rawText = rawText.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, ''); // strip any giant token of 100+ chars (common for base64)
      
      // Strip SVG XML structures
      rawText = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, '');
      
      // Strip general HTML tags
      rawText = rawText.replace(/<[^>]*>/g, '');
      
      // Strip markdown image strings
      rawText = rawText.replace(/!\[.*?\]\(.*?\)/g, '');
      
      // Clean up other markdown elements
      const strippedMarkdown = rawText
        .replace(/#+\s+/g, '') // strip headings
        .replace(/\*\*|__/g, '') // strip bold
        .replace(/\*|_/g, '') // strip italics
        .trim();
      
      cleanTextRef.current = convertLatexToSpeakable(strippedMarkdown);
    }
  }, [noteContent, noteTitle]);

  // Load default voice setting
  useEffect(() => {
    getDefaultVoice().then((v) => {
      setSelectedVoice(v);
    });
  }, []);

  const startSpeaking = async () => {
    unlockAudioContext();
    if (!cleanTextRef.current) return;

    stopSpeech();
    setIsPreparing(true);
    setPreparingProgress(0);
    setIsPlaying(false);
    setIsPaused(false);
    setReadingProgress(0);

    const rateDelta = Math.round((rate - 1.0) * 100);
    const rateStr = rateDelta >= 0 ? `+${rateDelta}%` : `${rateDelta}%`;

    await speakText(cleanTextRef.current, {
      voiceId: selectedVoice,
      rate: rateStr,
      onPreparing: (prepPct) => {
        setIsPreparing(true);
        setPreparingProgress(prepPct);
      },
      onStart: () => {
        setIsPreparing(false);
        setIsPlaying(true);
        setIsPaused(false);
      },
      onPlaybackProgress: (playPct) => {
        setReadingProgress(playPct);
      },
      onDone: () => {
        setIsPreparing(false);
        setIsPlaying(false);
        setIsPaused(false);
        setReadingProgress(100);
      },
      onError: (err) => {
        console.error('TTS playback error:', err);
        setIsPreparing(false);
        setIsPlaying(false);
        setIsPaused(false);
      }
    });
  };

  const togglePause = () => {
    if (isPlaying) {
      if (isPaused) {
        resumeSpeech();
        setIsPaused(false);
      } else {
        pauseSpeech();
        setIsPaused(true);
      }
    } else if (isPreparing) {
      handleStopSpeaking();
    } else {
      startSpeaking();
    }
  };

  const handleStopSpeaking = () => {
    stopSpeech();
    setIsPreparing(false);
    setIsPlaying(false);
    setIsPaused(false);
    setReadingProgress(0);
    setPreparingProgress(0);
  };

  return (
    <Card className="border border-primary/20 bg-card/60 backdrop-blur-md shadow-md rounded-xl overflow-hidden transition-all duration-300">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Volume2 className={`h-4.5 w-4.5 ${isPlaying && !isPaused ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-tight">Audio Note Reader</h4>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> Free, natural Edge Text-to-Speech
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isPlaying && !isPreparing ? (
              <Button 
                onClick={startSpeaking} 
                size="sm" 
                className="h-8.5 rounded-lg gap-1.5 px-3.5 shadow-sm shadow-primary/15"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="text-xs font-medium">Listen Note</span>
              </Button>
            ) : isPreparing ? (
              <div className="flex items-center gap-1.5">
                <Button 
                  disabled
                  variant="secondary"
                  size="sm" 
                  className="h-8.5 rounded-lg gap-1.5 px-3 bg-primary/10 text-primary border border-primary/20"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs font-medium">Preparing {preparingProgress}%</span>
                </Button>
                <Button 
                  onClick={handleStopSpeaking} 
                  variant="destructive"
                  size="sm" 
                  className="h-8.5 rounded-lg gap-1.5 px-3"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="text-xs font-medium">Cancel</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button 
                  onClick={togglePause} 
                  variant="outline"
                  size="sm" 
                  className={`h-8.5 rounded-lg gap-1.5 px-3 ${isPaused ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
                  <span className="text-xs font-medium">{isPaused ? 'Resume' : 'Pause'}</span>
                </Button>
                <Button 
                  onClick={handleStopSpeaking} 
                  variant="destructive"
                  size="sm" 
                  className="h-8.5 rounded-lg gap-1.5 px-3"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="text-xs font-medium">Stop</span>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className={`h-8.5 w-8.5 rounded-lg border ${showSettings ? 'bg-muted' : 'border-input hover:bg-muted/50'}`}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Preparing Progress Banner */}
        {isPreparing && (
          <div className="w-full space-y-1.5 p-2.5 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center text-xs font-medium text-primary">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Preparing high-quality voiceover...</span>
              </span>
              <span className="font-mono text-[11px] font-semibold">{preparingProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                style={{ width: `${preparingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Playback Reading Progress Bar */}
        {isPlaying && (
          <div className="w-full space-y-1">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${readingProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
              <span>Reading: "{noteTitle.substring(0, 30)}{noteTitle.length > 30 ? '...' : ''}"</span>
              <span>{readingProgress}%</span>
            </div>
          </div>
        )}

        {/* Settings Area */}
        {showSettings && (
          <div className="p-3 bg-muted/40 rounded-xl border border-border/55 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Voice selector */}
              <div className="space-y-1.5 flex-1">
                <span className="text-[11px] font-medium text-muted-foreground">Microsoft Natural Voice</span>
                <Select value={selectedVoice} onValueChange={(val) => {
                  setSelectedVoice(val);
                  setDefaultVoice(val);
                }}>
                  <SelectTrigger className="h-9 text-xs bg-background border border-border/70 hover:border-border transition-colors shadow-none rounded-lg w-full flex justify-between items-center pr-3">
                    <span className="flex-1 text-left truncate">
                      {MICROSOFT_VOICES.find((v) => v.id === selectedVoice)?.name || "Select a voice"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl border border-border/80 shadow-lg">
                    {MICROSOFT_VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs py-2 rounded-md cursor-pointer transition-colors focus:bg-accent/80">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speed Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-medium text-muted-foreground">Reading Speed</span>
                  <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px]">{rate}x</Badge>
                </div>
                <div className="flex items-center gap-3 py-1">
                  <Slider 
                    value={[rate]} 
                    min={0.5} 
                    max={2.0} 
                    step={0.15} 
                    onValueChange={(val) => setRate(val[0])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
