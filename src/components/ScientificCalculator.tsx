import React, { useState } from 'react';
import { create, all } from 'mathjs';
import { Calculator, X, Delete, Command, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const math = create(all);

export const ScientificCalculator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const calculate = () => {
    try {
      const res = math.evaluate(expression);
      const formattedResult = math.format(res, { precision: 10 });
      setResult(formattedResult.toString());
      setHistory(prev => [expression + ' = ' + formattedResult, ...prev].slice(0, 5));
      setError(null);
    } catch (err: any) {
      setError('Invalid Expression');
      setResult(null);
    }
  };

  const clear = () => {
    setExpression('');
    setResult(null);
    setError(null);
  };

  const append = (val: string) => {
    setExpression(prev => prev + val);
    setError(null);
  };

  const backspace = () => {
    setExpression(prev => prev.slice(0, -1));
  };

  const buttons = [
    { label: 'sin', action: () => append('sin(') },
    { label: 'cos', action: () => append('cos(') },
    { label: 'tan', action: () => append('tan(') },
    { label: 'log', action: () => append('log10(') },
    { label: 'ln', action: () => append('log(') },
    { label: '√', action: () => append('sqrt(') },
    { label: '^', action: () => append('^') },
    { label: 'π', action: () => append('pi') },
    { label: 'e', action: () => append('e') },
    { label: '(', action: () => append('(') },
    { label: ')', action: () => append(')') },
    { label: '/', action: () => append('/') },
    { label: '7', action: () => append('7') },
    { label: '8', action: () => append('8') },
    { label: '9', action: () => append('9') },
    { label: '*', action: () => append('*') },
    { label: '4', action: () => append('4') },
    { label: '5', action: () => append('5') },
    { label: '6', action: () => append('6') },
    { label: '-', action: () => append('-') },
    { label: '1', action: () => append('1') },
    { label: '2', action: () => append('2') },
    { label: '3', action: () => append('3') },
    { label: '+', action: () => append('+') },
    { label: '0', action: () => append('0') },
    { label: '.', action: () => append('.') },
    { label: 'EXP', action: () => append('exp(') },
    { label: '=', action: calculate, primary: true },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4"
          >
            <Card className="w-[320px] shadow-2xl border-primary/20 overflow-hidden bg-background/95 backdrop-blur-sm">
              <CardHeader className="p-4 border-b bg-primary/5 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Scientific Calculator
                </CardTitle>
                <div className="flex items-center gap-1">
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded-md transition-colors">
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-[10px]">Use standard math notation or buttons.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      value={expression}
                      onChange={(e) => setExpression(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && calculate()}
                      placeholder="Expression..."
                      className="text-right font-mono pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-destructive"
                      onClick={backspace}
                    >
                      <Delete className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="h-8 flex items-center justify-end font-mono text-lg font-bold text-primary">
                    {error ? (
                      <span className="text-xs text-destructive">{error}</span>
                    ) : result ? (
                      <span>= {result}</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {buttons.map((btn, i) => (
                    <Button
                      key={i}
                      variant={btn.primary ? 'default' : 'outline'}
                      size="sm"
                      className={`h-9 text-xs font-medium ${btn.primary ? 'col-span-1' : ''}`}
                      onClick={btn.action}
                    >
                      {btn.label}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" className="h-9 text-xs font-bold text-destructive" onClick={clear}>
                    AC
                  </Button>
                </div>

                {history.length > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Recent</p>
                    <div className="space-y-1">
                      {history.map((h, i) => (
                        <div key={i} className="text-[10px] font-mono text-muted-foreground bg-muted/50 p-1 rounded truncate">
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg ring-4 ring-background border-2 border-primary/20"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Calculator className="h-6 w-6" />}
        </Button>
      </motion.div>
    </div>
  );
};
