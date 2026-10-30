/**
 * Generates the complete, standardized SKILL.md file for autonomous AI agents
 * connecting to the CoLearn Model Context Protocol (MCP) server.
 */

export function generateMcpSkillMarkdown(token: string, university: string, baseUrl: string): string {
  const uniUpper = (university || 'futo').toUpperCase().trim();
  const cleanBaseUrl = (baseUrl || 'https://colearn-backend-tzo9.onrender.com').replace(/\/+$/, '');

  return `---
name: "colearn-academic-agent"
description: "Model Context Protocol (MCP) skill for autonomous curriculum creation, lecture notes authoring, and past question sheet compiling on CoLearn using official PLX markup."
---

# CoLearn Academic Agent Skill

This skill grants autonomous AI agents full capabilities to search, author, inspect, and fix university-scoped courses, lecture notes, and past question sheets on CoLearn.

## Authentication & Server Configuration

- **Target University**: \`${uniUpper}\`
- **Live Render Base URL**: \`${cleanBaseUrl}\`
- **MCP SSE Endpoint**: \`${cleanBaseUrl}/api/mcp/sse\`
- **Stateless HTTP Endpoint**: \`${cleanBaseUrl}/api/mcp\`
- **Agent Bearer Token**: \`${token}\`

### MCP Client Configuration (\`claude_desktop_config.json\` / Cursor MCP)

\`\`\`json
{
  "mcpServers": {
    "colearn": {
      "url": "${cleanBaseUrl}/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}
\`\`\`

---

## Installation & Connection Instructions for AI Agents

Agents can connect directly to CoLearn MCP using official SSE/HTTP protocol clients without building ad-hoc custom socket wrappers:

### Option A: Official Python MCP Client (\`mcp\` / \`httpx\`)
Install the official Python MCP library:
\`\`\`bash
pip install mcp httpx
\`\`\`

Python client connection snippet:
\`\`\`python
import asyncio
from mcp.client.sse import sse_client
from mcp.client.session import ClientSession

async def run_colearn_agent():
    headers = {"Authorization": "Bearer ${token}"}
    async with sse_client("${cleanBaseUrl}/api/mcp/sse", headers=headers) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            
            # 1. Discover all tools
            tools = await session.list_tools()
            print("Available Tools:", [t.name for t in tools.tools])
            
            # 2. Search notes for a topic
            search_res = await session.call_tool("search_notes", {"query": "Sequence and series", "level": "100"})
            print("Search Results:", search_res.content[0].text)

asyncio.run(run_colearn_agent())
\`\`\`

### Option B: Node.js / TypeScript MCP Client (\`@modelcontextprotocol/sdk\`)
Install the official Node.js SDK:
\`\`\`bash
npm install @modelcontextprotocol/sdk
\`\`\`

Node.js client connection snippet:
\`\`\`typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function runCoLearnAgent() {
  const transport = new SSEClientTransport(
    new URL("${cleanBaseUrl}/api/mcp/sse"),
    {
      requestInit: {
        headers: {
          Authorization: "Bearer ${token}"
        }
      }
    }
  );

  const client = new Client({ name: "colearn-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  // Discover all 15 tools
  const tools = await client.listTools();
  console.log("Available tools:", tools.tools.map(t => t.name));

  // Search notes
  const result = await client.callTool({
    name: "search_notes",
    arguments: { query: "Thermodynamics", level: "200" }
  });
  console.log("Search Output:", result.content[0].text);
}

runCoLearnAgent().catch(console.error);
\`\`\`

### Option C: Direct Stateless HTTP JSON-RPC Requests
Agents can also issue stateless HTTP POST calls directly to \`${cleanBaseUrl}/api/mcp\`:

- Header: \`Authorization: Bearer ${token}\`
- Header: \`Content-Type: application/json\`

Request Payload to List All Tools (\`tools/list\`):
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
\`\`\`

Request Payload to Execute a Tool (\`tools/call\`):
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_notes",
    "arguments": {
      "query": "Fluid Mechanics",
      "level": "100"
    }
  }
}
\`\`\`

---

## Operating Protocol: Emulating a Human Hand

When asked to create, review, or fix notes and past questions for \`${uniUpper}\`, follow the **Human-Hand Protocol**:

1. **Locate or Discover**:
   - If asked to fix or locate a note (e.g. *"There's an issue in the 100 level note on Sequence and series, fix it"*), call \`search_notes({ query: "Sequence and series", level: "100" })\`.
   - Extract the \`noteId\` from the search results, then call \`get_note({ noteId })\` to read the content.

2. **Author in Official PLX v4.0 Format**:
   - Both the **CoLearn Web Portal** and **CoLearn Mobile App** render PLX v4.0 markup natively with zero quality drop-off.
   - Always structure lecture notes and question sheets in clean PLX markup wrapped inside \`<PLX> ... </PLX>\`.

3. **Strict Note vs Question Sheet Content Boundaries**:
   - **In Lecture Notes**: **NEVER** use question tags (\`<QUES>\`, \`<COR>\`, \`<INC>\`, \`<EXP>\`). Question tags are strictly prohibited in lecture notes; they are reserved exclusively for Question Sheets!
   - **In Question Sheets**: **NEVER** use the underline tag (\`<U>\` or \`<u>\`) anywhere in question sheets (neither in question prompts, options, nor explanations)!

4. **Table Authoring Discipline**:
   - **STRICT RULE: PIPE TABLES ARE STRICTLY FORBIDDEN AND DEPRECATED.** Never write pipe-delimited tables (\`Col 1 | Col 2\`). Pipe tables fail to render as tables on web and mobile views.
   - **ALWAYS** use clean CSV format (comma-separated values) inside \`<TABLE> ... </TABLE>\`.
   - **NEVER** include markdown header divider lines (\`|---|---|---|\`). Divider lines break table parsing!

5. **Upload via MCP Directly**:
   - Call native MCP tools directly using your MCP client context (\`create_note\`, \`update_note\`, \`upload_questions\`, \`update_question\`). Do **NOT** write or execute external Python, Bash, or Node scripts to interact with the MCP API.

6. **Inspect Visual Preview & Red KaTeX Errors**:
   - The MCP tool response embeds a Base64 PNG screenshot of the student view.
   - **RED Error Check**: Any LaTeX syntax error or invalid command is highlighted in bright **RED** (\`#f87171\`), exactly as students see it.
   - If a red error box appears in the preview image, immediately correct the LaTeX syntax in your PLX content and call \`update_note\` or \`update_question\` until the rendered preview is 100% clean and pristine.

7. **University Boundary Isolation**:
   - All mutations are quarantined strictly to \`${uniUpper}\`. Never attempt to alter other campuses' resources.

---

## MCP Setup & Tool Discovery for Agents

Do **NOT** attempt to write Python or Bash scripts to connect to this MCP. You are connected directly to the CoLearn MCP server.
- To discover all 15 available MCP tools and parameter schemas at runtime, call \`list_mcp_tools()\`.
- All requests use your authenticated agent token and are scoped automatically to \`${uniUpper}\`.

---

## CoLearn Note Standard - PLX v4.0 Specification

PLX (Pillara Extensible) uses a structured HTML-style syntax. Always use 2 spaces per indentation level.

### 1. Root Container
\`\`\`xml
<PLX>
  <!-- All tags must be placed inside <PLX> -->
</PLX>
\`\`\`

### 2. Headings (\`<H1>\`, \`<H2>\`)
\`\`\`xml
<H1>
  Main Title of the Note
</H1>

<H2>
  Sub-header or Section Title
</H2>
\`\`\`

### 3. Text Paragraphs (\`<TEXT>\`, \`<B>\`, \`<I>\`, \`<U>\`)
Use \`<TEXT>\` for standard text blocks. Inline math \`$ ... $\` and formatting tags (\`<B>\`, \`<I>\`, \`<U>\`) are supported:
\`\`\`xml
<TEXT>
  This is a regular text block. You can use <B>bold</B>, <I>italics</I>, and <U>underline</U> for emphasis.
</TEXT>
\`\`\`
*Note: \`<U>\` (underline) is supported in Lecture Notes, but is **STRICTLY FORBIDDEN** in Question Sheets!*

### 4. Display Math Equations (\`<MATH>\`)
Use \`<MATH>\` for standalone display equations:
\`\`\`xml
<MATH>
  \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}
</MATH>
\`\`\`

### 5. Tables (\`<TABLE>\`)
Tables **MUST** be wrapped in \`<TABLE> ... </TABLE>\` and **MUST ONLY** use CSV (comma-separated) format. Pipe-delimited tables (\`Col 1 | Col 2\`) and divider lines (\`|---|\`) are **STRICTLY FORBIDDEN**.

CSV Format (comma separated):
\`\`\`xml
<TABLE>
  Process, Condition, Heat Transfer $Q$, Work $W$
  Isothermal, $\\Delta U = 0$, $Q = W = nRT \\ln\\left(\\frac{V_2}{V_1}\\right)$, $W = nRT \\ln\\left(\\frac{V_2}{V_1}\\right)$
  Isochoric, $W = 0$, $Q = \\Delta U = n C_v \\Delta T$, $0$
</TABLE>
\`\`\`

### 6. Lists (\`<LIST>\`, \`<ORDERED>\`)
\`\`\`xml
<LIST>
  - Use bullet points
  - For unordered information
</LIST>

<ORDERED>
  1. Use numbers
  2. For step-by-step processes
</ORDERED>
\`\`\`

### 7. Question Cards (\`<QUES>\`) — FOR QUESTION SHEETS ONLY!
**STRICT RULE**: \`<QUES>\`, \`<COR>\`, \`<INC>\`, and \`<EXP>\` are ONLY used when compiling Question Sheets. They are **FORBIDDEN** in Lecture Notes!
\`\`\`xml
<QUES ="1">
  Who founded CoLearn?
  <COR ="Pillara Education 2026">
  <INC ="Microsoft">
  <INC ="Google">
  <INC ="Apple">
  <EXP ="CoLearn was founded by Pillara Education 2026 to revolutionize learning.">
</QUES>
\`\`\`

### 8. Videos & Diagrams
\`\`\`xml
<VIDEO>
  https://www.youtube.com/watch?v=example
</VIDEO>

<DIAGRAM>
  graph TD; A-->B;
</DIAGRAM>
\`\`\`

---

## Language Accents & Intu-Shorthand Compliance

When writing language content with diacritics, tonals, or subdots (Igbo, Yoruba, French, Spanish, etc.), maintain 100% precision:

1. **Subdots / Underdots (Igbo/Yoruba)**:
   - \`o.\` / \`O.\` -> \`ọ\` / \`Ọ\`
   - \`u.\` / \`U.\` -> \`ụ\` / \`Ụ\`
   - \`i.\` / \`I.\` -> \`ị\` / \`Ị\`
   - \`e.\` / \`E.\` -> \`ẹ\` / \`Ẹ\`
   - \`s.\` / \`S.\` -> \`ṣ\` / \`Ṣ\`
   - \`n.\` / \`N.\` -> \`ṅ\` / \`Ṅ\`

2. **Vowel Accents & Tonals (Igbo/Yoruba High & Low tones)**:
   - High tone over subdot: \`o.'\` / \`ọ'\` -> \`ọ́\`, \`u.'\` -> \`ụ́\`, \`e.'\` -> \`ẹ́\`
   - Low tone over subdot: \`o.\\\`\` / \`ọ\\\`\` -> \`ọ̀\`, \`u.\\\`\` -> \`ụ̀\`, \`e.\\\`\` -> \`ẹ̀\`
   - Standard Tonal Shortcuts: High tone (\`a'\` -> \`á\`), Low tone (\`a\\\`\` -> \`à\`), Mid/macron (\`a-\` -> \`ā\`)

3. **European Diacritics**:
   - French Cedilla: \`c,\` -> \`ç\`
   - Circumflex: \`a^\` -> \`â\`, \`e^\` -> \`ê\`, \`o^\` -> \`ô\`
   - Umlaut: \`e:\` -> \`ë\`, \`u:\` -> \`ü\`
   - Tilde: \`n~\` -> \`ñ\`

---

## AI Prompt Strategy

1. Analyze the provided technical/lecture content.
2. Convert it into a valid CoLearn PLX v4.0 document wrapped in \`<PLX>\` tags using \`<TAG> ... </TAG>\` syntax internally.
3. Always start with \`<PLX>\` and end with \`</PLX>\`.
4. Wrap all tables in \`<TABLE> ... </TABLE>\` and NEVER include \`|---|---|\` divider lines.
5. In Lecture Notes: NEVER include \`<QUES>\`, \`<COR>\`, \`<INC>\`, or \`<EXP>\`.
6. In Question Sheets: NEVER include \`<U>\` or \`<u>\` (underline) tags.
7. Maintain strict 2-space indentation inside all container tags.
8. Ensure every opening tag has a matching closing tag.

---

## MCP Tools Reference

### 1. \`search_notes\`
Search and pinpoint lecture notes across \`${uniUpper}\` by topic, keyword, course code, or academic level.
- **Parameters**: \`query\` (required), \`level\` (optional), \`semester\` (optional), \`courseCode\` (optional)
- **Output**: Returns matching notes with \`noteId\`, \`title\`, \`courseCode\`, \`level\`, and context \`snippet\`.

### 2. \`list_courses\`
List available academic courses for \`${uniUpper}\`.
- **Parameters**: \`level\` (optional), \`semester\` (optional), \`department\` (optional)

### 3. \`create_course\`
Create a new course under \`${uniUpper}\`.
- **Parameters**: \`code\`, \`title\`, \`semester\`, \`level\`, \`department\`, \`units\`

### 4. \`list_notes\`
List existing lecture notes for a course ID.
- **Parameters**: \`courseId\`

### 5. \`get_note\`
Retrieve full content and metadata for a note ID.
- **Parameters**: \`noteId\`

### 6. \`create_note\`
Create a new lecture note. Content must be formatted in official CoLearn PLX v4.0 format. Tables MUST be wrapped in \`<TABLE>\` without \`|---|\` divider lines. Question tags are forbidden in notes. Returns embedded Base64 PNG preview.
- **Parameters**: \`courseId\`, \`title\`, \`content\` (PLX markup string)

### 7. \`update_note\`
Update and fix an existing note. Returns updated Base64 PNG preview with red KaTeX error highlighting if errors remain.
- **Parameters**: \`noteId\`, \`title\` (optional), \`content\` (optional PLX markup string)

### 8. \`preview_note\`
Fetch the Base64 PNG student-view reading image for a note ID.
- **Parameters**: \`noteId\`

### 9. \`create_question_sheet\`
Create a past question sheet container.
- **Parameters**: \`courseId\`, \`semester\`, \`academicLevel\`, \`year\`

### 10. \`list_question_sheets\`
List past question sheets for a course.
- **Parameters**: \`courseId\`

### 11. \`get_question_sheet\`
Retrieve questions and metadata for a question sheet.
- **Parameters**: \`sheetId\`

### 12. \`upload_questions\`
Upload multiple CBT questions to a sheet with options and explanations. Underline (\`<U>\`) tags are forbidden in question sheets.
- **Parameters**: \`sheetId\`, \`questions: [{ text, correctAnswer, incorrectAnswers, explanation }]\`

### 13. \`update_question\`
Update an individual question in a sheet. Underline (\`<U>\`) tags are forbidden in question sheets.
- **Parameters**: \`questionId\`, \`text\`, \`correctAnswer\`, \`incorrectAnswers\`, \`explanation\`, \`order\`

### 14. \`preview_question_sheet\`
Inspect questions in 20-question grid snapshots matching the website student CBT viewer.
- **Parameters**: \`sheetId\`, \`batchIndex\` (0 for Q1-Q20, 1 for Q21-Q40, etc.)

### 15. \`list_mcp_tools\`
List all 15 available MCP tools, descriptions, and parameter schemas.
- **Parameters**: None
`;
}
