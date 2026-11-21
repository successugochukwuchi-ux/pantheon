---
name: plx-authoring
description: Standalone skill for authoring and verifying CoLearn PLX v4.0 (.plx) lecture notes, study materials, and CBT question sheets. Teaches exact PLX tag syntax, CSV tables, language accent tags (<A>...</A>), KaTeX-compatible LaTeX rules, and how to run the bundled zero-dependency verifier (scripts/verify-plx.cjs) before finishing.
---

# CoLearn PLX v4.0 Authoring & Standalone Verification Skill

Use this skill whenever generating, converting, editing, or validating `.plx` files (lecture notes, study materials, or CBT/past-question sheets). This skill folder is completely self-contained and includes a zero-dependency Node.js verifier at `scripts/verify-plx.cjs`.

---

## 1. Document Root & Structural Rules

1. **Raw PLX output only**: Do NOT wrap `.plx` file contents in Markdown code fences (` ```plx ` or ` ``` `) and do NOT add preamble or commentary outside `<PLX>...</PLX>`.
2. **Mandatory Root Tag**: Every file MUST start with `<PLX>` and end with `</PLX>`. Use exactly one `<PLX>...</PLX>` root pair.
3. **2-Space Indentation**: Indent top-level block tags by 2 spaces inside `<PLX>`, and inner content by 4 spaces (2 spaces per nesting level).
4. **Uppercase Tags**: Always write PLX tags in **UPPERCASE** (`<H1>`, `<TEXT>`, `<QUES>`, etc.). Lowercase tags break case-sensitive CBT question sheet imports.
5. **No Unwrapped Text**: Every line of content inside `<PLX>...</PLX>` MUST be inside one of the 13 supported block tags. Plain text placed directly inside `<PLX>` outside a block tag is skipped.
6. **No Unsupported Tags**: Do NOT invent HTML or Markdown tags at the top level (`<H3>`, `<P>`, `<DIV>`, `<CODE>`, `<NOTE>`, `<IMG>`, `<SUB>`, `<SUP>`, `<BR>`, `<HR>`).

---

## 2. Supported Top-Level PLX Tags

Only the following 13 top-level tags are recognized by the parser:

| Tag | Purpose | Notes |
| :--- | :--- | :--- |
| `<H1>...</H1>` | Main document title | Used as the note title. Do NOT put `# ` inside `<H1>`. |
| `<H2>...</H2>` | Section / sub-header | Do NOT put `## ` inside `<H2>`. |
| `<TEXT>...</TEXT>` | Body paragraph | Supports inline `<B>`, `<I>`, `<U>`, `<A>`, and `$...$` math. |
| `<B>...</B>` | Full-block bold highlight | Also usable inline inside `<TEXT>`, `<LIST>`, `<ORDERED>`, `<H1>`, `<H2>`. |
| `<I>...</I>` | Full-block italics | Also usable inline inside `<TEXT>`, `<LIST>`, `<ORDERED>`, `<H1>`, `<H2>`. |
| `<U>...</U>` | Full-block underline | Also usable inline inside `<TEXT>`, `<LIST>`, `<ORDERED>`, `<H1>`, `<H2>`. |
| `<MATH>...</MATH>` | Block/display LaTeX | **NEVER** put `$` or `$$` inside `<MATH>`. Raw LaTeX only. |
| `<LIST>...</LIST>` | Unordered bullet list | Prefix every item with `- ` on its own line. |
| `<ORDERED>...</ORDERED>` | Numbered list | Prefix every item with `1. `, `2. `, etc. on its own line. |
| `<TABLE>...</TABLE>` | Tabular data (CSV) | First line is header row. Wrap cells with commas in `"..."`. |
| `<VIDEO>...</VIDEO>` | Video link | Direct `https://...` URL (e.g. YouTube). |
| `<DIAGRAM>...</DIAGRAM>` | Diagram or image URL/code | Mermaid/text diagram or image URL. |
| `<QUES ="1">...</QUES>` | Multiple-choice question | Keep exact ` ="1"` attribute syntax (space before `=`). |

> **Critical Attribute Rule**: Never add named HTML attributes like `<TEXT class="lead">` or `<QUES id="1">`. Only nameless ` ="value"` (e.g. `<QUES ="1">`) is matched; any other attribute causes the entire block to fail parsing.

---

## 3. Authoring Rules by Content Type

### A. LaTeX & KaTeX Rules

All math is rendered with **KaTeX** (without `mhchem`). Follow these rules strictly:

1. **Inline Math (`$...$`)**:
   - Wrap equations inside `<H1>`, `<H2>`, `<TEXT>`, `<LIST>`, `<ORDERED>`, `<TABLE>` cells, and `<QUES>` fields in single dollar signs: `$E = mc^2$`.
   - **Single-line only**: Inline `$...$` MUST open and close on the **same line**. Multi-line `$...$` breaks inline math matching.
   - **Never leave bare LaTeX**: Always wrap `\frac`, `\sqrt`, Greek letters (`\alpha`, `\theta`), operators (`\sum`, `\int`, `\times`, `\leq`), and exponents in `$...$` or `<MATH>...</MATH>`.
   - **Avoid `\(...\)` and `\[...\]`**: Use `$...$` for inline math and `<MATH>...</MATH>` (or `$$...$$`) for display math.
2. **Block Math (`<MATH>...</MATH>`)**:
   - Write raw LaTeX inside `<MATH>...</MATH>` with **NO `$` or `$$` delimiters**.
3. **No `\ce{...}` (mhchem)**:
   - `\ce{...}` is unsupported and throws `Undefined control sequence: \ce`.
   - Write chemical equations using standard LaTeX math/text: e.g. `$\text{H}_2\text{O}$`, `$2\text{H}_2 + \text{O}_2 \rightarrow 2\text{H}_2\text{O}$`, `$\text{SO}_4^{2-}$`.
4. **Matrix / Cases Row Breaks (`\\`)**:
   - Always put a **space or newline after `\\`** before the next letter, e.g. `\begin{pmatrix} a & b \\ c & d \end{pmatrix}`, NEVER `\\c`. Double backslashes immediately followed by letters get collapsed into single-backslash commands (`\c`), breaking the matrix.
5. **Brace & Script Hygiene**:
   - Balance every `{` and `}`.
   - Group chained exponents/subscripts with braces: `{x^2}^3` (not `x^2^3`).
   - Escape `%` as `\%` and `&` as `\&` (except column separators inside `pmatrix`, `bmatrix`, `cases`, `aligned`, `array`).

---

### B. Tables (`<TABLE>...</TABLE>`)

1. Use **CSV format**: header row on line 1, data rows on subsequent lines.
2. **Quote cells containing commas**: e.g. `"Time of Flight, T", $\frac{2u\sin\theta}{g}$, s`.
3. **Consistent columns**: Every row must have the exact same number of columns as the header row.
4. **No Markdown divider rows**: Do NOT write `|---|---|` rows inside `<TABLE>`.
5. Never place an unwrapped `| col | col |` table inside `<TEXT>` — always use `<TABLE>`.

---

### C. Questions (`<QUES ="#">...</QUES>`)

```plx
  <QUES ="1">
    What is the SI unit of force?
    <COR ="Newton ($\text{N}$)">
    <INC ="Joule ($\text{J}$)">
    <INC ="Watt ($\text{W}$)">
    <INC ="Pascal ($\text{Pa}$)">
    <EXP ="Force equals mass times acceleration ($\text{kg}\cdot\text{m/s}^2$), defined as the Newton.">
  </QUES>
```

**Critical `<QUES>` Rules**:
1. **Space before `=`**: Always write `<QUES ="1">`, `<COR ="...">`, `<INC ="...">`, `<EXP ="...">`.
2. **Attribute syntax ONLY**: Always use `<COR ="...">`, `<INC ="...">`, `<EXP ="...">`. Never write paired `<COR>...</COR>` tags.
3. **No inner double quotes `"`**: Inside `"..."`, use single quotes `'` instead of `"`. Any inner `"` truncates the option or explanation.
4. **Single-line subtags**: Keep each `<COR ="...">`, `<INC ="...">`, and `<EXP ="...">` on one line ending with `">`.
5. **Avoid raw `<` in the question stem**: In CBT question imports, the stem is split at the first `<`. Inside `<QUES>` prompts, use `\lt` instead of `<` in LaTeX (e.g. `$x \lt 5$`), and stick to `<B>...</B>` (avoid `<I>`/`<U>`) in CBT question stems.
6. **Option counts**: Provide 1 non-empty `<COR ="...">`, up to 3 `<INC ="...">` options, and 1 `<EXP ="...">`.
7. **Note vs. Study Material**: Study materials strip `<QUES>` blocks; use `<QUES>` in Lecture Notes or Question Sheets.

---

### D. Language Diacritics & Accent Shorthand (`<A>...</A>`)

Keyboard accent shorthands are ONLY compiled inside `<A>...</A>` (or `[A]...[/A]`). English text outside `<A>...</A>` is never altered.

- **Subdots (Igbo/Yoruba)**: `o.` → `ọ`, `u.` → `ụ`, `i.` → `ị`, `e.` → `ẹ`, `s.` → `ṣ`, `n.` → `ṅ` (also uppercase `O.`, `U.`, etc.)
- **Combined Subdot + Tone**: `o.'` → `ọ́`, `o.\`` → `ọ̀`, `o.-` → `ọ̄` (same for `u.`, `i.`, `e.`)
- **Acute / Grave / Macron**: `a'` → `á`, `a\`` → `à`, `a-` → `ā` (`a, e, i, o, u`, plus `m, n` for acute/macron)
- **European Diacritics**: `c,` → `ç`, `a^` → `â` (`e^, i^, o^, u^`), `e:` → `ë` (`i:, u:`), `n~` → `ñ`

Example:
```plx
  <TEXT>
    In Yoruba, "good morning" is <A>e. ka.a'ro.</A>.
  </TEXT>
```

---

## 4. Mandatory Standalone Verification Workflow

After writing or editing any `.plx` file, **always verify it before finishing** using the bundled standalone verifier (`scripts/verify-plx.cjs` inside this skill directory). It requires only Node.js (`node`) and needs **zero external packages or project files**.

Run from this skill's directory (or pass the path to `scripts/verify-plx.cjs`):

```bash
# Lecture Note mode (default)
node scripts/verify-plx.cjs path/to/note.plx

# CBT / Past Question Sheet mode (strict <QUES> checks)
node scripts/verify-plx.cjs path/to/questions.plx --mode=questions

# Study Material mode (warns if <QUES> tags are present)
node scripts/verify-plx.cjs path/to/guide.plx --mode=study-material

# Machine-readable JSON report
node scripts/verify-plx.cjs path/to/note.plx --json

# Or verify via stdin
cat path/to/note.plx | node scripts/verify-plx.cjs --stdin
```

- **Exit code `0`**: Valid PLX (0 errors). Review any warnings.
- **Exit code `1`**: Contains syntax, structure, table, question, or KaTeX errors. Fix every `[Line N]` error reported and re-run until exit code is `0`.

---

## 5. Complete Valid Example

```plx
<PLX>
  <H1>
    Kinematics: Projectile Motion
  </H1>

  <H2>
    1. Equations of Motion
  </H2>

  <TEXT>
    A projectile launched with speed $u$ at angle $\theta$ experiences constant downward acceleration $g$. Its <B>horizontal velocity</B> remains $u\cos\theta$ throughout flight.
  </TEXT>

  <MATH>
    y = x\tan\theta - \frac{g x^2}{2 u^2 \cos^2\theta}
  </MATH>

  <LIST>
    - Horizontal range is maximized at $\theta = 45^\circ$.
    - Time of flight is $T = \frac{2u\sin\theta}{g}$.
  </LIST>

  <TABLE>
    Quantity, Expression, Unit
    "Maximum Height, $H$", $\frac{u^2\sin^2\theta}{2g}$, m
    "Horizontal Range, $R$", $\frac{u^2\sin(2\theta)}{g}$, m
  </TABLE>

  <QUES ="1">
    At what launch angle does a projectile achieve maximum horizontal range on level ground?
    <COR ="$45^\circ$">
    <INC ="$30^\circ$">
    <INC ="$60^\circ$">
    <INC ="$90^\circ$">
    <EXP ="Since $R = \frac{u^2\sin(2\theta)}{g}$, range is maximum when $\sin(2\theta) = 1$, giving $\theta = 45^\circ$.">
  </QUES>
</PLX>
```
