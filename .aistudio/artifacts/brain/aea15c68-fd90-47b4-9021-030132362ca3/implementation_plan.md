# CoLearn Model Context Protocol (MCP) Server & Agent Automation Suite

Empower Level 4 administrators and platform staff to delegate academic content creation (lecture notes, course syllabi, and past question sheets) to autonomous AI agents via a secure, university-scoped Model Context Protocol (MCP) server running directly on the CoLearn backend with real-time visual inspection previews.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction and operational rules have been confirmed based on your specifications:

- **Confirmed: Transport Protocol**: Standard MCP HTTP with Server-Sent Events (SSE) streaming transport (`/api/mcp/sse` and `/api/mcp/messages`), alongside a universal stateless JSON-RPC fallback (`/api/mcp`) for seamless compatibility with Cursor, Claude Desktop, and CLI agent runtimes.
- **Confirmed: Visual Feedback Loop**: Visual preview inspection returns embedded Base64 PNG images directly inside MCP tool results so multimodal agents can instantly inspect and fix LaTeX formulas, markdown formatting, and question layouts.
- **Confirmed: Direct Publishing**: Academic content created by authenticated agents is automatically published under the admin's university scope without draft gating.
- **Confirmed: Permanent Token Lifespan**: Agent tokens remain valid until manually revoked by the issuing administrator from the MCP tab.
- **Confirmed: University RBAC Boundaries**: Rigid multi-tenant enforcement ensures Level 4 admins and their delegated agents can strictly read, create, and edit courses, notes, and questions within their assigned institution (e.g., RSUST admins cannot view or modify FUTO assets). Level 5 super-admins retain cross-university governance.
- **Confirmed: Hands-Off Agent Bootstrap via `SKILL.md`**: The MCP tab will provide a one-click dynamic `SKILL.md` export pre-configured with the agent's token, API endpoints, university constraints, and tool documentation for immediate drop-in agent setup.
- **Confirmed: Image Upload Restriction**: Agent image uploads remain disabled until the automated diagram/image generation pipeline is introduced in a future release.

---

## 1. Overview & Core Concept

CoLearn MCP bridges autonomous AI agents directly with the CoLearn backend. By extending the existing Express server, administrators can spin up specialized curriculum bots to author lecture notes and assemble multi-year past question banks at scale while strictly isolating university data.

Agents verify their own work before publishing through a visual verification protocol:
1. **Lecture Notes**: Rendered as a high-density, student-facing preview with KaTeX typography, formatted headings, and clean margins.
2. **Question Sheets**: Rendered in structured 20-question grid snapshots showcasing question prompts, options (with answer markers), and detailed rationales.

```
┌────────────────────────────────────────────────────────┐
│                   Admin Control Panel                  │
│       (Level 4 / Admin / Level 5) -> "MCP" Tab         │
│  - Generate Permanent Agent Token                      │
│  - Download Pre-Configured SKILL.md                    │
│  - Revoke Tokens & Audit Agent Activity                │
└──────────────────────────┬─────────────────────────────┘
                           │ Agent Token + SKILL.md
                           ▼
┌────────────────────────────────────────────────────────┐
│               Autonomous Agent Runtime                 │
│         (Claude Desktop, Cursor, Custom Agent)         │
│  - Reads local SKILL.md                                │
│  - Connects to CoLearn MCP SSE / HTTP Endpoint         │
└──────────────────────────┬─────────────────────────────┘
                           │ MCP JSON-RPC 2.0 (Bearer Token)
                           ▼
┌────────────────────────────────────────────────────────┐
│            CoLearn Render Backend (/api/mcp)           │
│  - Authenticate Token & Enforce University Scope       │
│  - CRUD Courses, Lecture Notes, & Question Sheets      │
│  - Server-side KaTeX & SVG-to-PNG Preview Generator    │
│  - Returns Base64 PNG Visual Previews to Agent         │
└──────────────────────────┬─────────────────────────────┘
                           │ Direct Persistence
                           ▼
┌────────────────────────────────────────────────────────┐
│               Google Cloud Firestore                   │
│   /courses, /notes, /question_sheets, /mcp_tokens      │
└────────────────────────────────────────────────────────┘
```

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Administrator Experience (Admin Panel -> MCP Tab)
1. **Tab Navigation**: Admins navigate to the new `MCP` tab in `/administrator` (guarded for Level 4+ and verified Level 5 administrators).
2. **Zero-State & Active Tokens**: If no tokens exist, a clean empty state explains agent connectivity. When tokens exist, a tabular list displays: Token Name, University Scope (badge), Preview Token Snippet (`cl_agent_...****`), Created Date, Last Used timestamp, and a prominent `Revoke` action.
3. **Token Creation Modal**: Admin enters an Agent Label (e.g., "RSUST Mechanical Engineering Bot") and clicks "Generate Token". The generated token is revealed with a one-click copy button and a security notice.
4. **Dynamic `SKILL.md` Download**: A dedicated card allows the admin to select an active token and click **"Download Agent SKILL.md"** (or copy to clipboard). The generated file includes the exact remote endpoint, auth header, university restrictions, and instructions, allowing zero-friction agent setup.

#### B. Autonomous Agent Lifecycle
1. **Handshake**: The agent connects to `GET /api/mcp/sse` with `Authorization: Bearer cl_agent_...`.
2. **Catalog Discovery**: Agent invokes `list_courses` to explore active course codes for its university.
3. **Creation & Visual Crosscheck**:
   - Agent invokes `create_note` with course code, title, and markdown/LaTeX content.
   - MCP responds with the created note metadata AND an embedded Base64 PNG image rendering of the note.
   - Agent inspects the image; if syntax or alignment errors exist, it invokes `update_note` to refine the content.
4. **Question Sheet Assembly**:
   - Agent creates a question sheet via `create_question_sheet` and adds questions in batches via `upload_questions`.
   - Agent invokes `preview_question_sheet` with `batchIndex: 0` (questions 1–20) to inspect the 20-question grid image before finalizing.

### Visual Identity & Theme Tokens
- **Design System Alignment**: Tailored to CoLearn’s modern academic interface using standard Tailwind tokens.
- **Anti-Slop Discipline**: Zero static pill enclosures. Metadata (dates, tokens, universities) rendered as clean typography with subtle dot separators (`·`).
- **Tabular Figures**: All timestamps and token identifiers use `font-mono` and `tabular-nums` for crisp legibility.
- **Card Hierarchy**: Flat, single-elevation surfaces with `border border-neutral-200 dark:border-neutral-800`.

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Side SVG-to-PNG Vector Pipeline**:
  - *Decision*: Compile notes and 20-question grids directly on the Node.js backend using KaTeX for mathematical notation, rendered into clean SVG layouts and converted into high-density PNG buffers via `sharp`.
  - *Rationale*: Eliminates fragile headless Chromium browser dependencies on Render while guaranteeing sub-second render times, zero font clipping, and mathematically accurate formulas.
- **Permanent Scoped Tokens with Instant Revocation**:
  - *Decision*: Tokens never expire automatically unless the admin clicks "Revoke".
  - *Rationale*: Agent workflows (scraping, compiling, formatting) often run overnight or across weeks. Revocation state is cached in memory with Firestore synchronization for near-zero latency auth checks.
- **Strict University Guardrails in Middleware**:
  - *Decision*: Filter and validate all course IDs and note/question updates against `token.university` in the backend before touching Firestore.
  - *Rationale*: Prevents prompt-injected or misconfigured agents from mutating courses across universities.

---

## 4. Technical Architecture & Data Strategy

### Data Model & Firestore Collections

```
/mcp_tokens/{tokenId}
  ├── id: string (UUID)
  ├── tokenHash: string (SHA-256 for secure lookup)
  ├── tokenPrefix: string (e.g. "cl_agent_a1b2...")
  ├── name: string (e.g. "200L Past Questions Bot")
  ├── university: string (e.g. "futo", "rsust")
  ├── adminUid: string
  ├── adminEmail: string
  ├── level: "4" | "5"
  ├── status: "active" | "revoked"
  ├── createdAt: ISO string
  └── lastUsedAt: ISO string | null
```

### Backend MCP Endpoints (`server.ts`)
- `GET /api/mcp/sse`: Server-Sent Events endpoint establishing persistent MCP connection.
- `POST /api/mcp/messages`: Client-to-server JSON-RPC 2.0 message handler for active SSE sessions.
- `POST /api/mcp`: Direct stateless JSON-RPC 2.0 handler (accepts `tools/list`, `tools/call`, `initialize`).
- `GET /api/mcp/skill-template`: Utility route returning the customized `SKILL.md` markdown for a given token.

### MCP Tools Roster

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `list_courses` | `{ level?, semester? }` | Returns courses scoped to the admin's university |
| `create_course` | `{ code, title, semester, level, department?, units? }` | Creates a new course under the admin's university |
| `list_notes` | `{ courseId }` | Lists existing lecture notes for a course |
| `get_note` | `{ noteId }` | Fetches raw markdown and metadata of a note |
| `create_note` | `{ courseId, title, content }` | Creates a lecture note and returns embedded Base64 PNG preview |
| `update_note` | `{ noteId, title?, content? }` | Updates note content and returns updated Base64 PNG preview |
| `preview_note` | `{ noteId }` | Returns high-resolution Base64 PNG of student-facing note |
| `create_question_sheet` | `{ courseId, semester, academicLevel, year }` | Creates a past question container |
| `list_question_sheets` | `{ courseId }` | Lists existing question sheets for a course |
| `upload_questions` | `{ sheetId, questions: [...] }` | Appends questions with options and explanations |
| `update_question` | `{ questionId, text?, correctAnswer?, incorrectAnswers?, explanation? }` | Edits an individual question |
| `preview_question_sheet` | `{ sheetId, batchIndex? }` | Renders a 20-question grid as Base64 PNG (batch 0 = Q1–20) |

---

## 5. Verification Plan

1. **Compilation & Linting**: Run `compile_applet` and verify server and client bundle integrity.
2. **Token Lifecycle**: Generate, display, copy, and revoke tokens within the Admin Panel `MCP` tab.
3. **SKILL.md Export**: Verify downloaded `SKILL.md` contains accurate credentials, university scopes, and tool signatures.
4. **MCP Protocol Validation**: Test `initialize`, `tools/list`, and `tools/call` for course creation, note authoring, and question uploading.
5. **Image Rendering Quality**: Validate that returned Base64 PNG previews render KaTeX formulas, tabular structures, and 20-question grid layouts cleanly without artifacts.
