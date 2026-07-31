import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Settings2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { speakText, stopSpeech, getDefaultVoice, setDefaultVoice, MICROSOFT_VOICES } from '../lib/ttsService';

interface TextToSpeechReaderProps {
  noteContent: string;
  noteTitle: string;
}

export function convertLatexToSpeakable(text: string): string {
  if (!text) return '';
  // Convert standard inline and block LaTeX ($...$ or $$...$$) into phonetically clean English
  return text.replace(/\$\$?([\s\S]+?)\$\$?/g, (_, formula) => {
    let speakable = formula.trim();

    // 1. Pre-processing: remove formatting tags and bracket controls
    speakable = speakable.replace(/\\left/g, '').replace(/\\right/g, '');
    speakable = speakable.replace(/\\mathrm/g, '');
    speakable = speakable.replace(/\\text\s*\{([^}]+)\}/g, ' $1 ');
    speakable = speakable.replace(/\\mathrm\s*\{([^}]+)\}/g, ' $1 ');

    // 2. Trigonometric and common mathematical functions
    speakable = speakable.replace(/\\sin\b/g, ' sine of, ');
    speakable = speakable.replace(/\\cos\b/g, ' cosine of, ');
    speakable = speakable.replace(/\\tan\b/g, ' tangent of, ');
    speakable = speakable.replace(/\\ln\b/g, ' natural log of, ');
    speakable = speakable.replace(/\\log\b/g, ' log of, ');

    // 3. Vector / Arrow markers
    speakable = speakable.replace(/\\vec\{(\w)\}/g, ' vector, $1, ');
    speakable = speakable.replace(/\\bar\{(\w)\}/g, ' $1 bar, ');
    speakable = speakable.replace(/\\hat\{(\w)\}/g, ' $1 hat, ');

    // 4. Limits
    speakable = speakable.replace(/\\lim_\{([^\}]+)\s*\\to\s*([^}]+)\}/g, ' limit as $1, approaches $2, ');
    speakable = speakable.replace(/\\lim_\{([^\}]+)\}/g, ' limit as $1, ');

    // 5. Summations (Sum from lower to upper of ...)
    speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' sum from $1, to $2, of, ');
    speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^(\w)/g, ' sum from $1, to $2, of, ');
    speakable = speakable.replace(/\\sum\b/g, ' sum ');

    // 6. Integrals (Integral from lower to upper of ...)
    speakable = speakable.replace(/\\int_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' integral from $1, to $2, of, ');
    speakable = speakable.replace(/\\int_\{([^\}]+)\}\^(\w)/g, ' integral from $1, to $2, of, ');
    speakable = speakable.replace(/\\int\b/g, ' integral ');

    // 7. Fractions (handle derivatives first: \frac{dy}{dx} -> derivative of y with respect to x)
    speakable = speakable.replace(/\\frac\{d(\w)\}\{d(\w)\}/g, ' derivative of $1, with respect to $2, ');
    speakable = speakable.replace(/\\frac\{\\partial\s*(\w)\}\{\\partial\s*(\w)\}/g, ' partial derivative of $1, with respect to $2, ');
    
    let prev;
    do {
      prev = speakable;
      speakable = speakable.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, ' ($1, divided by, $2) ');
    } while (speakable !== prev);

    // 8. Superscripts / powers (avoiding collision with sum/integral limits already parsed)
    speakable = speakable.replace(/(\w+)\^2\b/g, '$1, squared, ');
    speakable = speakable.replace(/(\w+)\^3\b/g, '$1, cubed, ');
    speakable = speakable.replace(/\{?([^}^^]+)\}?\^\{([^}]+)\}/g, '$1, to the power of, $2, ');
    speakable = speakable.replace(/\{?([^}^^]+)\}?\^(\w)/g, '$1, to the power of, $2, ');

    // 9. Square roots
    speakable = speakable.replace(/\\sqrt\s*\{([^}]+)\}/g, ' the square root of, $1, ');
    speakable = speakable.replace(/\\sqrt\s*(\w)/g, ' the square root of, $1, ');

    // 10. Greek Letters conversion
    const greekLetters: Record<string, string> = {
      '\\alpha': 'alpha',
      '\\beta': 'beta',
      '\\gamma': 'gamma',
      '\\delta': 'delta',
      '\\epsilon': 'epsilon',
      '\\zeta': 'zeta',
      '\\eta': 'eta',
      '\\theta': 'theta',
      '\\iota': 'iota',
      '\\kappa': 'kappa',
      '\\lambda': 'lambda',
      '\\mu': 'mu',
      '\\nu': 'nu',
      '\\xi': 'xi',
      '\\pi': 'pi',
      '\\rho': 'rho',
      '\\sigma': 'sigma',
      '\\tau': 'tau',
      '\\upsilon': 'upsilon',
      '\\phi': 'phi',
      '\\chi': 'chi',
      '\\psi': 'psi',
      '\\omega': 'omega',
      '\\Delta': 'delta',
      '\\Sigma': 'sigma',
      '\\Omega': 'omega',
    };

    Object.entries(greekLetters).forEach(([latex, spoken]) => {
      const escaped = latex.replace(/\\/g, '\\\\');
      const regex = new RegExp(escaped, 'g');
      speakable = speakable.replace(regex, ` ${spoken} `);
    });

    // 11. Subscripts: v_initial -> v initial, v_{i} -> v i
    speakable = speakable.replace(/(\w+)_\{([^}]+)\}/g, '$1 sub $2');
    speakable = speakable.replace(/(\w+)_(\w)/g, '$1 sub $2');

    // 12. Math Operators & Relations
    speakable = speakable.replace(/\\infty/g, ' infinity ');
    speakable = speakable.replace(/\\partial/g, ' partial derivative ');
    speakable = speakable.replace(/\\times/g, ' times ');
    speakable = speakable.replace(/\\cdot/g, ' times ');
    speakable = speakable.replace(/\\div/g, ' divided by ');
    speakable = speakable.replace(/\\pm/g, ' plus or minus ');
    speakable = speakable.replace(/\\approx/g, ' approximately equals ');
    speakable = speakable.replace(/\\le/g, ' is less than or equal to ');
    speakable = speakable.replace(/\\ge/g, ' is greater than or equal to ');
    speakable = speakable.replace(/\\neq/g, ' is not equal to ');
    speakable = speakable.replace(/\\to/g, ' approaches ');
    speakable = speakable.replace(/\\(dots|ldots|cdots)/g, ', and so on, ');
    speakable = speakable.replace(/=/g, ', equals, ');
    speakable = speakable.replace(/\+/g, ' plus ');
    speakable = speakable.replace(/-/g, ' minus ');

    // Clean up leftover symbols, parenthesis and curly braces
    speakable = speakable.replace(/[{}]/g, ' ');
    speakable = speakable.replace(/\\/g, ' ');
    speakable = speakable.replace(/\s+/g, ' ').trim();

    return ` ${speakable} `;
  });
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(0.9);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cleanTextRef = useRef<string>('');

  // Extract clean speakable text from Note blocks
  useEffect(() => {
    try {
      const blocks = JSON.parse(noteContent);
      if (Array.isArray(blocks)) {
        const rawFullText = blocks
          .map((b: any) => {
            if (b.type === 'h1' || b.type === 'h2' || b.type === 'text') {
              return b.content || '';
            }
            if (b.type === 'math' && b.content) {
              const cleaned = b.content.trim();
              if (cleaned.startsWith('$')) return cleaned;
              return `$$${cleaned}$$`;
            }
            if (b.type === 'table' && b.content) {
              try {
                const rows = JSON.parse(b.content);
                return "Table content: " + rows.map((r: string[]) => r.join(', ')).join('. ');
              } catch {
                return '';
              }
            }
            return '';
          })
          .filter(Boolean)
          .join('. ');

        cleanTextRef.current = convertLatexToSpeakable(rawFullText);
      } else {
        cleanTextRef.current = convertLatexToSpeakable(noteContent);
      }
    } catch {
      // Fallback for markdown notes
      const strippedMarkdown = noteContent
        .replace(/#+\s+/g, '') // strip headings
        .replace(/\*\*|__/g, '') // strip bold
        .replace(/\*|_/g, '') // strip italics
        .trim();
      
      cleanTextRef.current = convertLatexToSpeakable(strippedMarkdown);
    }
  }, [noteContent]);

  // Load default voice setting
  useEffect(() => {
    getDefaultVoice().then((v) => {
      setSelectedVoice(v);
    });
  }, []);

  const startSpeaking = async () => {
    if (!cleanTextRef.current) return;

    stopSpeech();
    setIsPlaying(true);
    setIsPaused(false);
    setReadingProgress(0);

    await speakText(cleanTextRef.current, {
      voiceId: selectedVoice,
      onStart: () => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onDone: () => {
        setIsPlaying(false);
        setIsPaused(false);
        setReadingProgress(100);
      },
      onError: (err) => {
        console.error('TTS playback error:', err);
        setIsPlaying(false);
        setIsPaused(false);
      }
    });
  };

  const togglePause = () => {
    if (isPlaying) {
      handleStopSpeaking();
    } else {
      startSpeaking();
    }
  };

  const handleStopSpeaking = () => {
    stopSpeech();
    setIsPlaying(false);
    setIsPaused(false);
    setReadingProgress(0);
  };

  // Dynamically update voice rate if changed mid-speech
  useEffect(() => {
    if (isPlaying && !isPaused) {
      // Re-trigger from current speech state requires restarting with Web Speech API
      // so we let the rate apply for the next phrase or pause/play cycle.
    }
  }, [rate]);

  if (!voices.length) {
    return null; // Don't show anything if browser doesn't support TTS
  }

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
                <Sparkles className="h-3 w-3 text-amber-500" /> Free, native offline Text-to-Speech
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isPlaying ? (
              <Button 
                onClick={startSpeaking} 
                size="sm" 
                className="h-8.5 rounded-lg gap-1.5 px-3.5 shadow-sm shadow-primary/15"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="text-xs font-medium">Listen Note</span>
              </Button>
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

        {/* Progress Bar */}
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
                  <SelectTrigger className="h-9 text-xs bg-background border border-border/70 hover:border-border transition-colors shadow-none rounded-lg">
                    <SelectValue placeholder="Select a voice" />
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
