import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Key, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  FileText, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { McpAgentToken } from '../../types';
import { RENDER_BACKEND_URL } from '../../lib/backendConfig';

import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateMcpSkillMarkdown } from '../../lib/mcpSkillGenerator';
import { getBackendCandidates } from '../../lib/backendConfig';

interface AdminMcpProps {
  userProfile: any;
  userEmail?: string;
  isLevel5: boolean;
  university: string;
}

export const AdminMcp: React.FC<AdminMcpProps> = ({
  userProfile,
  userEmail,
  isLevel5,
  university
}) => {
  const [tokens, setTokens] = useState<McpAgentToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<{ rawToken: string; name: string } | null>(null);
  const [selectedTokenForSkill, setSelectedTokenForSkill] = useState<string>('');
  const [copiedRawToken, setCopiedRawToken] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);
  const [showToolsReference, setShowToolsReference] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const normalizedUni = (university || 'futo').toLowerCase().trim();
  const mcpBaseUrl = RENDER_BACKEND_URL || 'https://colearn-backend-tzo9.onrender.com';

  // Fetch tokens directly from Firestore for 100% reliability, with safe backend fallback
  const fetchTokens = async () => {
    setLoading(true);
    try {
      // 1. Direct Firestore query: instant, authenticated, immune to doctype/HTML SPA routing errors
      const tokensRef = collection(db, 'mcp_agent_tokens');
      const snap = await getDocs(tokensRef);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as McpAgentToken));

      if (!isLevel5) {
        list = list.filter(t => (t.university || 'futo').toLowerCase().trim() === normalizedUni);
      }

      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTokens(list);

      if (list.length > 0 && !selectedTokenForSkill) {
        const firstActive = list.find((t: McpAgentToken) => t.status === 'active');
        if (firstActive) {
          setSelectedTokenForSkill(firstActive.id);
        }
      }
    } catch (firestoreErr) {
      console.warn("Direct Firestore token query encountered an issue, trying backend candidates:", firestoreErr);
      
      // 2. Fallback: try backend candidate URLs with strict JSON verification
      const candidates = getBackendCandidates(`/api/mcp/tokens?adminUid=${encodeURIComponent(userProfile?.uid || '')}&university=${encodeURIComponent(normalizedUni)}&isLevel5=${isLevel5}`);
      let loaded = false;

      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const contentType = res.headers.get('content-type') || '';
          // Ensure response is actually JSON before calling res.json() to prevent <!doctype SyntaxError
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.success && Array.isArray(data.tokens)) {
              setTokens(data.tokens);
              loaded = true;
              break;
            }
          }
        } catch {
          // Continue to next candidate without breaking
        }
      }

      if (!loaded && tokens.length === 0) {
        toast.error("Could not load agent tokens. Please check network connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [userProfile?.uid, normalizedUni, isLevel5]);

  // Create token with direct Firestore persistence and Web Crypto API
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) {
      toast.error("Please enter a descriptive name for this agent token");
      return;
    }

    setCreating(true);
    try {
      // Generate cryptographically secure random token in browser
      const arr = new Uint8Array(24);
      window.crypto.getRandomValues(arr);
      const randomSecret = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      const rawToken = `cl_agent_${randomSecret}`;

      // SHA-256 hash using Web Crypto API
      const enc = new TextEncoder();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(rawToken));
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const tokenPrefix = `cl_agent_${randomSecret.slice(0, 6)}...${randomSecret.slice(-4)}`;

      const tokenId = window.crypto.randomUUID 
        ? window.crypto.randomUUID() 
        : `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const tokenRecord: McpAgentToken = {
        id: tokenId,
        tokenHash,
        tokenPrefix,
        name: tokenName.trim(),
        university: normalizedUni,
        adminUid: userProfile?.uid || 'admin',
        adminEmail: userEmail || userProfile?.email || 'admin@colearn.app',
        level: String(userProfile?.level || '4'),
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      };

      // 1. Write directly to Firestore
      await setDoc(doc(db, 'mcp_agent_tokens', tokenId), tokenRecord);

      // 2. Asynchronously notify backend candidates if available
      const candidates = getBackendCandidates('/api/mcp/tokens/create');
      for (const url of candidates) {
        try {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              name: tokenName.trim(),
              university: normalizedUni,
              adminUid: userProfile?.uid,
              adminEmail: userEmail || userProfile?.email || 'admin@colearn.app',
              level: userProfile?.level || '4'
            })
          }).catch(() => {});
          break;
        } catch {}
      }

      setNewlyCreatedToken({
        rawToken,
        name: tokenName.trim()
      });
      setTokenName('');
      setIsCreateOpen(false);
      toast.success("Agent token generated successfully!");
      fetchTokens();
    } catch (err: any) {
      toast.error(err.message || "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  // Revoke token
  const handleRevokeToken = (tokenId: string, name: string) => {
    setTokenToRevoke({ id: tokenId, name });
  };

  const confirmRevokeToken = async () => {
    if (!tokenToRevoke) return;
    setRevoking(true);
    try {
      // 1. Update directly in Firestore
      await updateDoc(doc(db, 'mcp_agent_tokens', tokenToRevoke.id), { status: 'revoked' });

      // 2. Asynchronously notify backend candidates if available
      const candidates = getBackendCandidates('/api/mcp/tokens/revoke');
      for (const url of candidates) {
        try {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenId: tokenToRevoke.id,
              adminUid: userProfile?.uid,
              university: normalizedUni,
              isLevel5
            })
          }).catch(() => {});
          break;
        } catch {}
      }

      toast.success(`Token '${tokenToRevoke.name}' has been permanently revoked`);
      setTokenToRevoke(null);
      fetchTokens();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke token");
    } finally {
      setRevoking(false);
    }
  };

  // Copy raw token
  const copyRawToken = (tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr);
    setCopiedRawToken(true);
    toast.success("Agent token copied to clipboard");
    setTimeout(() => setCopiedRawToken(false), 2500);
  };

  // Download SKILL.md directly client-side with zero network dependency
  const handleDownloadSkill = (targetToken?: string) => {
    const tokenToUse = targetToken || newlyCreatedToken?.rawToken || "INSERT_YOUR_AGENT_TOKEN_HERE";
    const skillContent = generateMcpSkillMarkdown(tokenToUse, normalizedUni, mcpBaseUrl);

    const blob = new Blob([skillContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COLEARN_${normalizedUni.toUpperCase()}_AGENT_SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded agent SKILL.md file!");
  };

  // Copy SKILL.md markdown directly client-side
  const handleCopySkill = (targetToken?: string) => {
    const tokenToUse = targetToken || newlyCreatedToken?.rawToken || "INSERT_YOUR_AGENT_TOKEN_HERE";
    const skillContent = generateMcpSkillMarkdown(tokenToUse, normalizedUni, mcpBaseUrl);

    navigator.clipboard.writeText(skillContent);
    setCopiedSkill(true);
    toast.success("SKILL.md content copied to clipboard!");
    setTimeout(() => setCopiedSkill(false), 2500);
  };

  const activeTokens = tokens.filter(t => t.status === 'active');

  return (
    <div className="space-y-6">
      {/* Top Banner / University RBAC Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Bot className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Model Context Protocol (MCP) Console</h2>
          </div>
          <p className="text-sm text-slate-300">
            Allow autonomous AI agents (Claude Desktop, Cursor, CLI agents) to author lecture notes and assemble past questions directly on your behalf.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400 font-medium">
            <span className="text-slate-300 font-semibold">Security Scope:</span>
            <span className="text-blue-400 font-mono uppercase bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded">
              {isLevel5 ? 'GLOBAL SUPERADMIN (ALL UNIVERSITIES)' : `${normalizedUni.toUpperCase()} EXCLUSIVE`}
            </span>
            <span>·</span>
            <span>Render Backend Live</span>
            <span>·</span>
            <span>Permanent Tokens</span>
            <span>·</span>
            <span>Zero Image Uploads (Disabled)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            Generate Agent Token
          </Button>
          <Button
            variant="outline"
            onClick={fetchTokens}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Newly Created Token Display Box */}
      {newlyCreatedToken && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 text-emerald-100 space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Agent Token Generated for '{newlyCreatedToken.name}'</span>
          </div>
          <p className="text-xs text-emerald-300/90 leading-relaxed">
            Copy this token now or download the pre-configured <strong className="font-semibold text-white">SKILL.md</strong> file. For security, the full secret string will never be displayed again.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 bg-black/40 border border-emerald-500/30 rounded-lg p-2.5 font-mono text-xs text-emerald-200 select-all overflow-x-auto">
              {newlyCreatedToken.rawToken}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => copyRawToken(newlyCreatedToken.rawToken)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
              >
                {copiedRawToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedRawToken ? "Copied" : "Copy Token"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadSkill(newlyCreatedToken.rawToken)}
                className="border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/50 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download SKILL.md
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Tokens List + Agent Setup / Skill Export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Active & Revoked Tokens Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-neutral-200 dark:border-neutral-800 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Active Agent Tokens</CardTitle>
                  <CardDescription className="text-xs">
                    Permanent tokens configured to act on your behalf for {normalizedUni.toUpperCase()}.
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground font-mono tabular-nums">
                  {activeTokens.length} Active / {tokens.length} Total
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {tokens.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Key className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold">No Agent Tokens Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Generate an agent token to authenticate Claude, Cursor, or your autonomous script to curate notes and past question sheets.
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Generate First Token
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-y border-neutral-200 dark:border-neutral-800 text-neutral-500 font-medium">
                      <tr>
                        <th className="py-2.5 px-4">Token Name & Prefix</th>
                        <th className="py-2.5 px-4">University</th>
                        <th className="py-2.5 px-4">Created</th>
                        <th className="py-2.5 px-4">Last Activity</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-normal">
                      {tokens.map((token) => {
                        const isActive = token.status === 'active';
                        return (
                          <tr key={token.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {token.name}
                              </div>
                              <div className="font-mono text-[11px] text-neutral-500 select-all">
                                {token.tokenPrefix || 'cl_agent_••••'}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono uppercase text-neutral-600 dark:text-neutral-300">
                              {token.university || 'FUTO'}
                            </td>
                            <td className="py-3 px-4 text-neutral-500 font-mono tabular-nums">
                              {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-neutral-500 font-mono tabular-nums">
                              {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {isActive ? 'Active' : 'Revoked'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isActive ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownloadSkill(token.tokenPrefix)}
                                    title="Download SKILL.md template"
                                    className="h-7 px-2 text-neutral-600 hover:text-neutral-900"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRevokeToken(token.id, token.name)}
                                    title="Revoke token"
                                    className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-neutral-400 italic">Revoked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collapsible Tool Reference */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 p-4 space-y-3">
            <button
              onClick={() => setShowToolsReference(!showToolsReference)}
              className="w-full flex items-center justify-between text-left text-sm font-semibold text-neutral-900 dark:text-neutral-100"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>MCP Tool Capabilities Reference (14 Available Tools)</span>
              </div>
              {showToolsReference ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showToolsReference && (
              <div className="pt-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">search_notes</div>
                    <p className="text-[11px]">Intelligently pinpoint lecture notes by query, topic, course code, or level to retrieve noteId before inspecting or updating.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">list_courses / create_course</div>
                    <p className="text-[11px]">Discover or create university-scoped courses with codes, semester, level, and credit units.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">create_note / update_note</div>
                    <p className="text-[11px]">Author lecture notes with tables and LaTeX math. Automatically returns an embedded Base64 PNG showing the exact student reading view.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">upload_questions / update_question</div>
                    <p className="text-[11px]">Add questions in batches to a past question sheet with options and step-by-step explanations.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">preview_question_sheet</div>
                    <p className="text-[11px]">Returns a 20-question grid-style photo (Q1-20, Q21-40) with prompts, highlighted answers (✓), and explanations for inspection.</p>
                  </div>
                </div>
                <div className="text-[11px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-lg text-amber-800 dark:text-amber-300">
                  <strong>Formatting & Restrictions:</strong> Full support for Headings (H1-H4), KaTeX math ($...$ and $$...$$), and Markdown tables. Image and diagram uploads are disabled until the diagram generation engine is released.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Agent Setup & SKILL.md Download */}
        <div className="space-y-4">
          <Card className="border border-neutral-200 dark:border-neutral-800 shadow-none bg-neutral-50/50 dark:bg-neutral-900/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-base font-semibold">Hands-Off Agent Setup</CardTitle>
              </div>
              <CardDescription className="text-xs leading-relaxed">
                Download a custom <strong className="font-semibold text-neutral-800 dark:text-neutral-200">SKILL.md</strong> file pre-configured with your active token and university rules. Drop it into your agent directory for instant autonomous work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              
              {/* Endpoint URLs */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Live Render MCP SSE Endpoint
                </Label>
                <div className="p-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded font-mono text-[11px] text-neutral-800 dark:text-neutral-200 select-all truncate">
                  {`${mcpBaseUrl}/api/mcp/sse`}
                </div>
              </div>

              {/* Cursor / Claude Desktop Config */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Cursor / Claude Desktop Config
                </Label>
                <pre className="p-2.5 bg-neutral-900 text-neutral-100 rounded text-[10px] font-mono leading-tight overflow-x-auto">
{`{
  "mcpServers": {
    "colearn": {
      "url": "${mcpBaseUrl}/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer <YOUR_AGENT_TOKEN>"
      }
    }
  }
}`}
                </pre>
              </div>

              {/* Download / Copy Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => handleDownloadSkill()}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 flex items-center justify-center gap-2 text-xs h-9 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Custom SKILL.md
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCopySkill()}
                  className="w-full border-neutral-300 dark:border-neutral-700 flex items-center justify-center gap-2 text-xs h-9"
                >
                  {copiedSkill ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedSkill ? "Copied SKILL.md" : "Copy SKILL.md Contents"}
                </Button>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-900 dark:text-blue-300 space-y-1 text-[11px]">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>University Boundary Guarded</span>
                </div>
                <p className="leading-normal">
                  The agent cannot view or alter other universities' courses or past questions. All mutations are strictly quarantined to <strong className="font-bold">{normalizedUni.toUpperCase()}</strong>.
                </p>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* Create Token Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateToken}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                Generate New Agent Token
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                This token allows an autonomous AI agent to connect to CoLearn's MCP server and work on behalf of your administrative account for {normalizedUni.toUpperCase()}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="tokenName" className="font-semibold">
                  Agent Label / Purpose <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="tokenName"
                  placeholder="e.g. Mechanical 200L Past Questions Bot"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  A recognizable name so you can track which bot is performing actions.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] space-y-1">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Target University: <span className="uppercase font-mono text-blue-600 dark:text-blue-400">{normalizedUni}</span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Tokens are permanent until you explicitly click "Revoke" in this panel.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={creating || !tokenName.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                {creating ? "Generating..." : "Generate Token"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!tokenToRevoke} onOpenChange={(open) => { if (!open) setTokenToRevoke(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Revoke Agent Token
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to permanently revoke token <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{tokenToRevoke?.name}</strong>? Any running AI agent using this token will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={revoking}
              onClick={() => setTokenToRevoke(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={revoking}
              onClick={confirmRevokeToken}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              {revoking ? "Revoking..." : "Revoke Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
