import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Copy, 
  Check, 
  RefreshCw, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Server, 
  Globe, 
  Key, 
  ExternalLink 
} from 'lucide-react';
import { Button } from './ui/button';
import { HermesDiagnostics, runHermesHealthCheck } from '../services/aiService';
import { AIConfig } from '../types';
import { toast } from 'sonner';

interface HermesDiagnosticCardProps {
  diagnostics?: HermesDiagnostics;
  errorMessage: string;
  onRetry?: () => void;
  aiConfig?: AIConfig | null;
}

export function HermesDiagnosticCard({
  diagnostics,
  errorMessage,
  onRetry,
  aiConfig,
}: HermesDiagnosticCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [liveHealth, setLiveHealth] = useState<HermesDiagnostics | null>(null);

  const activeDiag = liveHealth || diagnostics;

  const generateDiagnosticMarkdown = (): string => {
    const diag = activeDiag;
    if (!diag) {
      return `### Hermes Diagnostic Report\n- Error: ${errorMessage}\n- Host: ${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}`;
    }

    let md = `### 🩺 Hermes Diagnostic Report\n`;
    md += `**Timestamp:** ${diag.timestamp}\n`;
    md += `**App Hostname:** \`${diag.appHostname}\` (Static Host: ${diag.isStaticHost ? 'Yes (Wasmer/SPA)' : 'No'})\n`;
    md += `**Provider Configured:** \`${diag.provider}\` (Model: \`${diag.model}\`)\n`;
    md += `**Base URL:** \`${diag.baseUrl || 'Default'}\`\n`;
    md += `**API Key Status:** ${diag.hasApiKey ? `Configured (${diag.maskedKey})` : 'Missing'}\n\n`;
    md += `#### 🎯 Pinpointed Primary Cause\n${diag.primaryCause}\n\n`;
    md += `#### 💡 Recommendation\n${diag.recommendation}\n\n`;

    md += `#### 📡 Attempt & Trace Log (${diag.attempts.length} attempts):\n`;
    diag.attempts.forEach((att, idx) => {
      md += `${idx + 1}. **${att.strategy === 'backend_proxy' ? 'Backend Proxy' : 'Direct Fallback'}**: \`${att.target}\`\n`;
      md += `   - **Status:** ${att.status ? `${att.status} ${att.statusText || ''}` : (att.statusText || 'Failed')}\n`;
      md += `   - **Duration:** ${att.durationMs}ms\n`;
      if (att.contentType) md += `   - **Content-Type:** ${att.contentType}\n`;
      if (att.error) md += `   - **Error Detail:** ${att.error}\n`;
      if (att.responseSnippet) md += `   - **Response Snippet:** ${att.responseSnippet}\n`;
    });

    return md;
  };

  const handleCopy = async () => {
    try {
      const text = generateDiagnosticMarkdown();
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Diagnostic report copied to clipboard! Paste it to share what went wrong.');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const handleRunHealthCheck = async () => {
    setIsChecking(true);
    toast.info('Running live health probe across backend and provider endpoints...');
    try {
      const result = await runHermesHealthCheck(aiConfig || undefined);
      setLiveHealth(result);
      toast.success('Health probe complete! Review the live trace below.');
    } catch (err: any) {
      toast.error('Health probe failed: ' + (err?.message || 'Network error'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 text-destructive dark:text-red-400 p-3.5 space-y-3 text-xs w-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-destructive dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 animate-pulse" />
          <span>Hermes Connection Diagnostic</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold tracking-wider">
          {activeDiag?.isStaticHost ? 'Wasmer Static Host' : 'Full-Stack Host'}
        </span>
      </div>

      {/* Primary Pinpointed Cause Banner */}
      <div className="rounded-lg bg-background/80 dark:bg-zinc-900/80 p-2.5 border border-destructive/20 space-y-1">
        <div className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 text-[11px]">
          <span>🎯 Pinpointed Cause:</span>
        </div>
        <p className="text-foreground dark:text-zinc-200 text-xs font-normal leading-relaxed">
          {activeDiag?.primaryCause || errorMessage}
        </p>
        {activeDiag?.recommendation && (
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <span className="font-semibold text-foreground">Next Step:</span> {activeDiag.recommendation}
          </p>
        )}
      </div>

      {/* Action Buttons: Copy, Retry, Run Health Check */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 px-2.5 text-[11px] bg-background hover:bg-muted text-foreground flex items-center gap-1"
          title="Copy formatted diagnostic log to clipboard"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
          <span>{isCopied ? 'Copied Log!' : 'Copy Diagnostic Report'}</span>
        </Button>

        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onRetry}
            className="h-7 px-2.5 text-[11px] flex items-center gap-1 shadow-sm"
            title="Retry the message request"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleRunHealthCheck}
          disabled={isChecking}
          className="h-7 px-2 text-[11px] flex items-center gap-1"
          title="Probe live reachability of backend proxy and provider"
        >
          <Activity className={`h-3 w-3 ${isChecking ? 'animate-spin text-amber-500' : 'text-primary'}`} />
          <span>{isChecking ? 'Testing...' : 'Live Probe'}</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 px-1.5 text-[11px] ml-auto text-muted-foreground hover:text-foreground"
        >
          <span>{isExpanded ? 'Hide Trace' : 'Show Trace'}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
        </Button>
      </div>

      {/* Expandable Technical Trace */}
      {isExpanded && activeDiag && (
        <div className="space-y-2 pt-2 border-t border-destructive/15 text-[11px]">
          {/* Environment Pills */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground bg-muted/40 p-2 rounded-md">
            <div className="flex items-center gap-1 truncate">
              <Globe className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate" title={activeDiag.appHostname}>Host: {activeDiag.appHostname}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <Server className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">Type: {activeDiag.isStaticHost ? 'Wasmer Static' : 'Node Full-Stack'}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <Activity className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">Provider: {activeDiag.provider} ({activeDiag.model})</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <Key className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">Key: {activeDiag.hasApiKey ? activeDiag.maskedKey : 'Missing'}</span>
            </div>
          </div>

          {/* Detailed Attempt Trace */}
          <div className="space-y-1.5">
            <div className="font-semibold text-foreground text-[11px] flex items-center justify-between">
              <span>Attempt Trace ({activeDiag.attempts.length}):</span>
              {liveHealth && <span className="text-[10px] text-emerald-600 font-normal">● Live Probe Active</span>}
            </div>

            {activeDiag.attempts.map((att, idx) => (
              <div 
                key={idx} 
                className="p-2 rounded bg-background dark:bg-zinc-900 border border-border/60 space-y-1 font-mono text-[10px]"
              >
                <div className="flex items-center justify-between gap-1 text-foreground">
                  <span className="font-semibold truncate max-w-[200px]" title={att.target}>
                    {idx + 1}. {att.target.replace('https://', '')}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    att.success 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                      : att.status === 405 || att.error?.includes('Wasmer') 
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}>
                    {att.status ? `${att.status} ${att.statusText || ''}` : (att.statusText || 'Failed')} ({att.durationMs}ms)
                  </span>
                </div>

                {att.contentType && (
                  <div className="text-muted-foreground text-[9px]">
                    content-type: <span className="text-foreground">{att.contentType}</span>
                  </div>
                )}

                {att.error && (
                  <div className="text-red-500 dark:text-red-400 text-[10px] font-sans leading-tight">
                    ↳ {att.error}
                  </div>
                )}

                {att.responseSnippet && (
                  <div className="text-muted-foreground text-[9px] truncate bg-muted/40 p-1 rounded font-mono">
                    snippet: {att.responseSnippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
