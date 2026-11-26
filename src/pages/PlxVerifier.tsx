import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eye,
  FileCheck2,
  FileText,
  HelpCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { customPlxComponents } from '../components/MathMarkdown';
import { SafeMathRenderer, prepareMarkdownMath } from '../components/SafeMathRenderer';
import { verifyPlxDocument, PlxVerifyOptions } from '../lib/plxVerifier';
import { useTitle } from '../hooks/useTitle';

const SAMPLE_VALID_PLX = `<PLX>
  <H1>
    Projectile Motion and Vectors
  </H1>

  <H2>
    1. Horizontal and Vertical Components
  </H2>

  <TEXT>
    When an object is launched at an angle $\\theta$ with initial speed $u$, its velocity splits into <B>horizontal</B> ($u_x = u\\cos\\theta$) and <I>vertical</I> ($u_y = u\\sin\\theta$) components. In Yoruba, greeting is <A>e. ka.a'ro.</A>.
  </TEXT>

  <MATH>
    R = \\frac{u^2 \\sin(2\\theta)}{g}
  </MATH>

  <LIST>
    - Horizontal acceleration is zero ($a_x = 0$).
    - Vertical acceleration is $-g$ downward.
  </LIST>

  <TABLE>
    Quantity, Formula, SI Unit
    "Time of Flight, T", $\\frac{2u\\sin\\theta}{g}$, s
    Maximum Height, $\\frac{u^2\\sin^2\\theta}{2g}$, m
  </TABLE>

  <QUES ="1">
    At maximum height of a projectile, what is the vertical velocity component?
    <COR ="$0\\text{ m/s}$">
    <INC ="$u\\cos\\theta$">
    <INC ="$u\\sin\\theta$">
    <INC ="$g$">
    <EXP ="At the peak of its trajectory, vertical velocity momentarily equals zero before descending.">
  </QUES>
</PLX>`;

export default function PlxVerifier() {
  useTitle('PLX & LaTeX Verifier');
  const [source, setSource] = useState<string>(SAMPLE_VALID_PLX);
  const [mode, setMode] = useState<NonNullable<PlxVerifyOptions['mode']>>('note');
  const [checkIndentation, setCheckIndentation] = useState<boolean>(true);
  const [fileName, setFileName] = useState<string>('sample.plx');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(
    () => verifyPlxDocument(source, { mode, checkIndentation }),
    [source, mode, checkIndentation]
  );

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSource(text);
    setFileName(file.name);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-6 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              CoLearn PLX &amp; LaTeX Verifier
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              PLX v4.0
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Validate AI-generated <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">.plx</code> files locally against CoLearn&apos;s exact parser, CSV table rules, Question Sheet rules, and KaTeX renderer before uploading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".plx,.txt,text/plain"
            className="hidden"
            onChange={handleFileLoad}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" /> Load .plx / .txt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSource(SAMPLE_VALID_PLX);
              setFileName('sample.plx');
            }}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" /> Load Sample
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSource('');
              setFileName('untitled.plx');
            }}
            className="gap-1.5 text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      {/* Mode & Status Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Target Mode:
          </span>
          {(
            [
              { id: 'note', label: 'Lecture Note (NoteBuilder)' },
              { id: 'study-material', label: 'Study Material (No <QUES>)' },
              { id: 'questions', label: 'Question Sheet (AdminPanel)' },
            ] as const
          ).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={mode === item.id ? 'default' : 'outline'}
              onClick={() => setMode(item.id)}
              className="text-xs h-8"
            >
              {item.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={checkIndentation ? 'secondary' : 'ghost'}
            onClick={() => setCheckIndentation((v) => !v)}
            className="text-xs h-8"
          >
            Indent Check: {checkIndentation ? 'On' : 'Off'}
          </Button>
        </div>

        <div className="lg:col-span-5 flex flex-wrap items-center lg:justify-end gap-2">
          {result.valid ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5 px-3 py-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready to Upload ({result.summary.totalBlocks} blocks, {result.summary.mathExpressionsChecked} math checked)
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              {result.errors.length} Error{result.errors.length === 1 ? '' : 's'} Found
            </Badge>
          )}
          {result.warnings.length > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1.5 px-3 py-1 text-xs"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {result.warnings.length} Warning{result.warnings.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Raw PLX Input & Diagnostics */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Raw PLX Source
                </CardTitle>
                <CardDescription className="text-xs font-mono mt-0.5">
                  {fileName} &bull; {source.split('\n').length} lines
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(result.summary.byType).map(([tag, count]) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] font-mono">
                    {tag}:{count}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Paste raw <PLX>...</PLX> content here or load a .plx file..."
                className="min-h-[380px] font-mono text-xs leading-relaxed resize-y"
                spellCheck={false}
              />
            </CardContent>
          </Card>

          {/* Diagnostics List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Verification Diagnostics</CardTitle>
              <CardDescription className="text-xs">
                Checks root &lt;PLX&gt;, tag balance, CSV columns, &lt;QUES&gt; subtags, accent tags, and strict KaTeX parsing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[380px] overflow-y-auto">
              {result.issues.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">All checks passed!</div>
                    <div className="text-xs opacity-90">
                      Syntax, LaTeX/KaTeX expressions, tables, and structure match CoLearn&apos;s parser cleanly.
                    </div>
                  </div>
                </div>
              ) : (
                result.issues.map((issue, idx) => (
                  <div
                    key={`${issue.code}-${issue.line}-${idx}`}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      issue.severity === 'error'
                        ? 'bg-destructive/5 border-destructive/30'
                        : 'bg-amber-500/5 border-amber-500/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold">
                        {issue.severity === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className={issue.severity === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                          Line {issue.line}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {issue.code}
                        </Badge>
                        {issue.tag && (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            &lt;{issue.tag}&gt;
                          </Badge>
                        )}
                      </div>
                      <span className="uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                        {issue.category}
                      </span>
                    </div>

                    <p className="text-foreground leading-relaxed">{issue.message}</p>

                    {issue.snippet && (
                      <pre className="p-2 rounded bg-muted/70 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                        {issue.snippet}
                      </pre>
                    )}

                    {issue.suggestion && (
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">Fix:</strong> {issue.suggestion}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Exact Website Render Preview & Parsed Output */}
        <Card className="lg:sticky lg:top-6">
          <Tabs defaultValue="preview">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b">
              <div>
                <CardTitle className="text-base">Website Parser Output</CardTitle>
                <CardDescription className="text-xs">
                  Exact live rendering via CoLearn&apos;s <code className="font-mono">SafeMathRenderer</code> &amp; <code className="font-mono">MathMarkdown</code>
                </CardDescription>
              </div>
              <TabsList>
                <TabsTrigger value="preview" className="gap-1.5 text-xs">
                  <Eye className="h-3.5 w-3.5" /> Live Render
                </TabsTrigger>
                <TabsTrigger value="blocks" className="gap-1.5 text-xs">
                  <Code2 className="h-3.5 w-3.5" /> Blocks JSON
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4 max-h-[760px] overflow-y-auto">
              <TabsContent value="preview" className="space-y-5 mt-0">
                {result.noteBuilderBlocks.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground italic">
                    No blocks parsed yet. Fix structural errors on the left to preview rendered output.
                  </div>
                ) : (
                  result.noteBuilderBlocks.map((block) => (
                    <div key={block.id} className="space-y-1">
                      {block.type === 'h1' && (
                        <h1 className="text-2xl font-bold border-b pb-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                            components={customPlxComponents}
                          >
                            {prepareMarkdownMath(block.content)}
                          </ReactMarkdown>
                        </h1>
                      )}

                      {block.type === 'h2' && (
                        <h2 className="text-xl font-bold pt-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                            components={customPlxComponents}
                          >
                            {prepareMarkdownMath(block.content)}
                          </ReactMarkdown>
                        </h2>
                      )}

                      {(block.type === 'text' || block.type === 'bullet-list' || block.type === 'numbered-list') && (
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                            components={customPlxComponents}
                          >
                            {prepareMarkdownMath(block.content)}
                          </ReactMarkdown>
                        </div>
                      )}

                      {block.type === 'math' && (
                        <div className="py-3 px-4 overflow-x-auto flex justify-center bg-muted/40 rounded-lg border">
                          <SafeMathRenderer math={block.content} block={true} />
                        </div>
                      )}

                      {block.type === 'table' && (() => {
                        try {
                          const data = JSON.parse(block.content);
                          if (!Array.isArray(data) || data.length === 0) return null;
                          const headerRow = data[0];
                          const bodyRows = data.slice(1);
                          return (
                            <div className="overflow-x-auto border rounded-xl bg-card">
                              <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr className="bg-muted/70 border-b">
                                    {headerRow.map((cell: string, ci: number) => (
                                      <th key={ci} className="p-2.5 font-bold border-r last:border-r-0">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkMath, remarkGfm]}
                                          rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                          components={customPlxComponents}
                                        >
                                          {prepareMarkdownMath(cell)}
                                        </ReactMarkdown>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {bodyRows.map((row: string[], ri: number) => (
                                    <tr key={ri} className="border-b last:border-b-0">
                                      {row.map((cell: string, ci: number) => (
                                        <td key={ci} className="p-2.5 border-r last:border-r-0">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkMath, remarkGfm]}
                                            rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                            components={customPlxComponents}
                                          >
                                            {prepareMarkdownMath(cell)}
                                          </ReactMarkdown>
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        } catch {
                          return <div className="text-xs text-destructive">Invalid table JSON</div>;
                        }
                      })()}

                      {block.type === 'question' && (() => {
                        try {
                          const q = JSON.parse(block.content);
                          return (
                            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                                <HelpCircle className="h-3.5 w-3.5" />
                                Question {block.settings?.questionId ? `#${block.settings.questionId}` : ''}
                              </div>
                              <div className="text-sm font-medium">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                  components={customPlxComponents}
                                >
                                  {prepareMarkdownMath(q.question || '')}
                                </ReactMarkdown>
                              </div>
                              {q.correct && (
                                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                                  <strong className="text-emerald-600 dark:text-emerald-400">Correct: </strong>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                    components={customPlxComponents}
                                  >
                                    {prepareMarkdownMath(q.correct)}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {Array.isArray(q.incorrect) &&
                                q.incorrect.map((inc: string, i: number) => (
                                  <div key={i} className="p-2 rounded-lg bg-muted/60 border text-xs">
                                    <strong className="text-muted-foreground">Incorrect: </strong>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                      components={customPlxComponents}
                                    >
                                      {prepareMarkdownMath(inc)}
                                    </ReactMarkdown>
                                  </div>
                                ))}
                              {q.explanation && (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs italic">
                                  <strong>Explanation: </strong>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: 'inherit' }]]}
                                    components={customPlxComponents}
                                  >
                                    {prepareMarkdownMath(q.explanation)}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          );
                        } catch {
                          return <div className="text-xs text-destructive">Invalid question JSON</div>;
                        }
                      })()}

                      {block.type === 'video' && (
                        <div className="p-3 rounded-lg bg-muted font-mono text-xs text-primary">
                          VIDEO URL: {block.content}
                        </div>
                      )}

                      {block.type === 'diagram' && (
                        <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                          {block.content}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="blocks" className="mt-0 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                    NoteBuilder Upload Output ({result.noteBuilderBlocks.length} NoteBlocks)
                  </div>
                  <pre className="p-3 rounded-xl bg-muted/60 border font-mono text-[11px] overflow-x-auto max-h-[340px]">
                    {JSON.stringify(result.noteBuilderBlocks, null, 2)}
                  </pre>
                </div>
                {result.adminQuestions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                      AdminPanel Question Sheet Import Output ({result.adminQuestions.length} Questions)
                    </div>
                    <pre className="p-3 rounded-xl bg-muted/60 border font-mono text-[11px] overflow-x-auto max-h-[260px]">
                      {JSON.stringify(result.adminQuestions, null, 2)}
                    </pre>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
