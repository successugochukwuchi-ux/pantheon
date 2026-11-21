import fs from 'node:fs';
import path from 'node:path';
import { verifyPlxDocument, PlxVerifyOptions } from '../src/lib/plxVerifier';

function printUsage() {
  console.log(`
CoLearn PLX & LaTeX Verifier (PLX v4.0 + KaTeX)

Usage:
  node scripts/verify-plx.cjs <file1.plx> [file2.plx ...] [options]
  cat note.plx | node scripts/verify-plx.cjs --stdin [options]

Options:
  --mode=<note|study-material|questions>   Target validation mode (default: note)
  --no-indent                              Ignore 2-space indentation warnings
  --json                                   Output structured JSON report
  --stdin                                  Read PLX content from standard input
  --help, -h                               Show this help message
`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let mode: PlxVerifyOptions['mode'] = 'note';
  let checkIndentation = true;
  let jsonOutput = false;
  let useStdin = false;
  const files: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const val = arg.split('=')[1];
      if (val === 'note' || val === 'study-material' || val === 'questions') {
        mode = val;
      } else {
        console.error(`Invalid mode "${val}". Expected: note | study-material | questions`);
        process.exit(1);
      }
    } else if (arg === '--no-indent') {
      checkIndentation = false;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--stdin') {
      useStdin = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  const targets: Array<{ label: string; content: string }> = [];

  if (useStdin) {
    targets.push({ label: '<stdin>', content: await readStdin() });
  } else {
    for (const fileArg of files) {
      const resolved = path.resolve(process.cwd(), fileArg);
      if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${fileArg}`);
        process.exit(1);
      }
      targets.push({
        label: fileArg,
        content: fs.readFileSync(resolved, 'utf8'),
      });
    }
  }

  if (targets.length === 0) {
    printUsage();
    process.exit(1);
  }

  let hasAnyErrors = false;
  const jsonReports: Record<string, unknown> = {};

  for (const target of targets) {
    const result = verifyPlxDocument(target.content, { mode, checkIndentation });
    if (!result.valid) hasAnyErrors = true;

    if (jsonOutput) {
      jsonReports[target.label] = {
        valid: result.valid,
        summary: result.summary,
        errors: result.errors,
        warnings: result.warnings,
        blocksParsed: result.noteBuilderBlocks.length,
        adminQuestionsParsed: result.adminQuestions.length,
      };
      continue;
    }

    const statusBadge = result.valid ? 'PASS' : 'FAIL';
    console.log(`\n=== [${statusBadge}] ${target.label} (mode: ${mode}) ===`);
    console.log(
      `Blocks: ${result.summary.totalBlocks} | Math expressions checked: ${result.summary.mathExpressionsChecked} | Questions: ${result.summary.questionsCount} | Tables: ${result.summary.tablesCount}`
    );
    const tagBreakdown = Object.entries(result.summary.byType)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    if (tagBreakdown) {
      console.log(`Tag breakdown: ${tagBreakdown}`);
    }

    if (result.errors.length > 0) {
      console.log(`\nERRORS (${result.errors.length}):`);
      for (const err of result.errors) {
        console.log(`  [Line ${err.line}] [${err.code}]${err.tag ? ` <${err.tag}>` : ''} ${err.message}`);
        if (err.snippet) console.log(`    Snippet: ${err.snippet}`);
        if (err.suggestion) console.log(`    Fix: ${err.suggestion}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\nWARNINGS (${result.warnings.length}):`);
      for (const warn of result.warnings) {
        console.log(`  [Line ${warn.line}] [${warn.code}]${warn.tag ? ` <${warn.tag}>` : ''} ${warn.message}`);
        if (warn.snippet) console.log(`    Snippet: ${warn.snippet}`);
        if (warn.suggestion) console.log(`    Fix: ${warn.suggestion}`);
      }
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('\nAll PLX syntax, structure, and KaTeX checks passed cleanly.');
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(targets.length === 1 ? Object.values(jsonReports)[0] : jsonReports, null, 2));
  }

  process.exit(hasAnyErrors ? 1 : 0);
}

main().catch((err) => {
  console.error('Verifier crashed:', err);
  process.exit(1);
});
