import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { serverDb } from './firebaseServer.js';
import { authenticateAgentToken, mcpService, AgentContext } from './mcpService.js';

export const mcpRouter = express.Router();

// In-memory active SSE sessions: sessionId -> { res, agent }
const sseSessions = new Map<string, { res: Response; agent: AgentContext }>();

// Clean up disconnected sessions
setInterval(() => {
  for (const [id, session] of sseSessions.entries()) {
    if (session.res.writableEnded || session.res.destroyed) {
      sseSessions.delete(id);
    }
  }
}, 60000);

/**
 * MCP Tools Declarations
 */
const MCP_TOOLS = [
  {
    name: "list_courses",
    description: "List academic courses available under the authenticated administrator's university.",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", description: "Optional academic level filter (e.g. '100', '200', '300', '400', '500')" },
        semester: { type: "string", enum: ["1st", "2nd"], description: "Optional semester filter" },
        department: { type: "string", description: "Optional department filter" }
      }
    }
  },
  {
    name: "create_course",
    description: "Create a new course under the administrator's university.",
    inputSchema: {
      type: "object",
      required: ["code", "title", "semester", "level"],
      properties: {
        code: { type: "string", description: "Course code, e.g. 'ENG 201' or 'MTH 101'" },
        title: { type: "string", description: "Course title, e.g. 'General Engineering Mathematics I'" },
        semester: { type: "string", enum: ["1st", "2nd"], description: "Academic semester" },
        level: { type: "string", description: "Academic level, e.g. '100', '200', '300'" },
        department: { type: "string", description: "Department name (leave empty for General Course)" },
        units: { type: "number", description: "Course credit units (default: 3)" }
      }
    }
  },
  {
    name: "search_notes",
    description: "Search and find lecture notes across the administrator's university by topic, keyword, course code, or academic level. Returns matching notes with noteId, title, course details, and content snippets so agents can easily locate notes to inspect or update.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Topic or keyword to search for (e.g. 'Sequence and series', 'Thermodynamics', 'Matrices')" },
        level: { type: "string", description: "Optional academic level filter (e.g. '100', '200', '300', '400', '500')" },
        semester: { type: "string", enum: ["1st", "2nd"], description: "Optional semester filter" },
        courseCode: { type: "string", description: "Optional course code filter (e.g. 'MTH 101', 'PHY 101')" },
        courseId: { type: "string", description: "Optional course document ID to restrict search" }
      }
    }
  },
  {
    name: "list_mcp_tools",
    description: "List all 15 available Model Context Protocol (MCP) tools, descriptions, and parameter schemas available on CoLearn.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "list_notes",
    description: "List all existing lecture notes for a specific course to inspect, crosscheck, or edit.",
    inputSchema: {
      type: "object",
      required: ["courseId"],
      properties: {
        courseId: { type: "string", description: "Firestore document ID of the course" }
      }
    }
  },
  {
    name: "get_note",
    description: "Retrieve full markdown content, metadata, and formulas for a specific lecture note.",
    inputSchema: {
      type: "object",
      required: ["noteId"],
      properties: {
        noteId: { type: "string", description: "Firestore document ID of the note" }
      }
    }
  },
  {
    name: "create_note",
    description: "Create a new lecture note for a course. Publishes directly and returns a Base64 PNG image showing exactly what students see when reading, enabling visual inspection and editing.",
    inputSchema: {
      type: "object",
      required: ["courseId", "title", "content"],
      properties: {
        courseId: { type: "string", description: "Course document ID" },
        title: { type: "string", description: "Lecture note title (e.g. 'Module 1: Thermodynamics Fundamentals')" },
        content: { type: "string", description: "Complete note content formatted in Markdown and LaTeX formulas (e.g. $E=mc^2$ or $$\\int x dx$$)" }
      }
    }
  },
  {
    name: "update_note",
    description: "Update an existing lecture note (title or content) within the administrator's university. Returns an updated Base64 PNG visual inspection preview of the note.",
    inputSchema: {
      type: "object",
      required: ["noteId"],
      properties: {
        noteId: { type: "string", description: "Firestore document ID of the note" },
        title: { type: "string", description: "New or corrected title" },
        content: { type: "string", description: "Corrected content in Markdown and LaTeX" }
      }
    }
  },
  {
    name: "preview_note",
    description: "Crosscheck visual formatting for an existing note. Returns a rendered Base64 PNG image of what students see in their reading view.",
    inputSchema: {
      type: "object",
      required: ["noteId"],
      properties: {
        noteId: { type: "string", description: "Firestore document ID of the note" }
      }
    }
  },
  {
    name: "create_question_sheet",
    description: "Create a new past question / CBT question sheet container for a course.",
    inputSchema: {
      type: "object",
      required: ["courseId", "semester", "academicLevel", "year"],
      properties: {
        courseId: { type: "string", description: "Course document ID" },
        semester: { type: "string", enum: ["1st", "2nd"], description: "Semester" },
        academicLevel: { type: "string", description: "Level, e.g. '100', '200'" },
        year: { type: "string", description: "Past question examination year (e.g. '2023/2024')" }
      }
    }
  },
  {
    name: "list_question_sheets",
    description: "List all question sheets associated with a given course.",
    inputSchema: {
      type: "object",
      required: ["courseId"],
      properties: {
        courseId: { type: "string", description: "Course document ID" }
      }
    }
  },
  {
    name: "get_question_sheet",
    description: "Fetch all questions and metadata for a past question sheet.",
    inputSchema: {
      type: "object",
      required: ["sheetId"],
      properties: {
        sheetId: { type: "string", description: "Question sheet document ID" }
      }
    }
  },
  {
    name: "upload_questions",
    description: "Append questions with multiple-choice options and explanations to a question sheet.",
    inputSchema: {
      type: "object",
      required: ["sheetId", "questions"],
      properties: {
        sheetId: { type: "string", description: "Question sheet document ID" },
        questions: {
          type: "array",
          description: "List of questions to upload",
          items: {
            type: "object",
            required: ["text", "correctAnswer", "incorrectAnswers"],
            properties: {
              text: { type: "string", description: "Question prompt text (LaTeX supported)" },
              correctAnswer: { type: "string", description: "The correct answer text" },
              incorrectAnswers: {
                type: "array",
                items: { type: "string" },
                description: "Array of 3 incorrect distractor options"
              },
              explanation: { type: "string", description: "Detailed step-by-step academic explanation" },
              order: { type: "number", description: "Optional question number sequence" }
            }
          }
        }
      }
    }
  },
  {
    name: "update_question",
    description: "Edit or fix an individual question in a sheet (prompt, answers, explanation) within the administrator's university.",
    inputSchema: {
      type: "object",
      required: ["questionId"],
      properties: {
        questionId: { type: "string", description: "Question document ID" },
        text: { type: "string", description: "Updated question text" },
        correctAnswer: { type: "string", description: "Updated correct answer" },
        incorrectAnswers: { type: "array", items: { type: "string" }, description: "Updated distractors" },
        explanation: { type: "string", description: "Updated explanation" },
        order: { type: "number", description: "Updated order sequence" }
      }
    }
  },
  {
    name: "preview_question_sheet",
    description: "Visually preview a question sheet. Returns a grid-style image showing 20 questions per batch with their question text, options (correct highlighted with ✓), and explanation.",
    inputSchema: {
      type: "object",
      required: ["sheetId"],
      properties: {
        sheetId: { type: "string", description: "Question sheet document ID" },
        batchIndex: { type: "number", description: "Batch index (0 for Q1-Q20, 1 for Q21-Q40, 2 for Q41-Q60, etc.)" }
      }
    }
  }
];

/**
 * Executes a tool and formats the response according to the MCP specification
 */
async function executeTool(agent: AgentContext, name: string, args: any) {
  switch (name) {
    case "list_courses": {
      const data = await mcpService.listCourses(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "create_course": {
      const data = await mcpService.createCourse(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "list_notes": {
      const data = await mcpService.listNotes(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "get_note": {
      const data = await mcpService.getNote(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "search_notes": {
      const data = await mcpService.searchNotes(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "list_mcp_tools": {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, count: MCP_TOOLS.length, tools: MCP_TOOLS }, null, 2) }]
      };
    }
    case "create_note": {
      const data = await mcpService.createNote(agent, args);
      const base64Data = data.previewImageBase64.replace(/^data:image\/png;base64,/, '');
      return {
        content: [
          { 
            type: "text", 
            text: `Note created and published successfully!\nID: ${data.noteId}\nTitle: ${data.title}\nUniversity: ${data.university}\nInspect the returned student reading view image below to verify LaTeX math and text formatting.` 
          },
          {
            type: "image",
            data: base64Data,
            mimeType: "image/png"
          }
        ]
      };
    }
    case "update_note": {
      const data = await mcpService.updateNote(agent, args);
      const base64Data = data.previewImageBase64.replace(/^data:image\/png;base64,/, '');
      return {
        content: [
          { 
            type: "text", 
            text: `Note ${data.noteId} updated successfully.\nTitle: ${data.title}\nInspect the updated student reading view image below.` 
          },
          {
            type: "image",
            data: base64Data,
            mimeType: "image/png"
          }
        ]
      };
    }
    case "preview_note": {
      const data = await mcpService.previewNote(agent, args);
      const base64Data = data.previewImageBase64.replace(/^data:image\/png;base64,/, '');
      return {
        content: [
          { 
            type: "text", 
            text: `Preview generated for note '${data.title}' (ID: ${data.noteId}).` 
          },
          {
            type: "image",
            data: base64Data,
            mimeType: "image/png"
          }
        ]
      };
    }
    case "create_question_sheet": {
      const data = await mcpService.createQuestionSheet(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "list_question_sheets": {
      const data = await mcpService.listQuestionSheets(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "get_question_sheet": {
      const data = await mcpService.getQuestionSheet(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "upload_questions": {
      const data = await mcpService.uploadQuestions(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "update_question": {
      const data = await mcpService.updateQuestion(agent, args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }
    case "preview_question_sheet": {
      const data = await mcpService.previewQuestionSheet(agent, args);
      const base64Data = data.previewImageBase64.replace(/^data:image\/png;base64,/, '');
      return {
        content: [
          { 
            type: "text", 
            text: `Questions ${data.startQuestionNumber}-${data.endQuestionNumber} of ${data.totalQuestions} (Batch ${data.batchIndex + 1} of ${data.totalBatches}) for ${data.courseCode}.\nInspect the 20-question grid below to check prompts, option correctness (✓), and explanations.` 
          },
          {
            type: "image",
            data: base64Data,
            mimeType: "image/png"
          }
        ]
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Handle incoming JSON-RPC 2.0 Request
 */
async function handleJsonRpc(agent: AgentContext, body: any): Promise<any> {
  const { id, method, params } = body;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: "colearn-mcp-server",
          version: "1.0.0"
        },
        instructions: `Authenticated as Agent '${agent.name}' for University '${agent.university.toUpperCase()}'. You have authorization to create courses, author notes, and curate past question sheets strictly within '${agent.university.toUpperCase()}'. Visual inspection images are returned automatically.`
      }
    };
  }

  if (method === "notifications/initialized") {
    return null; // Notifications don't require response
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS
      }
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    try {
      const toolResult = await executeTool(agent, name, args || {});
      return {
        jsonrpc: "2.0",
        id,
        result: toolResult
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: err.message || "Tool execution error"
        }
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

/**
 * Helper to extract Bearer token from header or query
 */
function extractToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return '';
}

// -------------------------------------------------------------
// MCP Server-Sent Events (SSE) Transport
// -------------------------------------------------------------

// 1. GET /api/mcp/sse - Initialize SSE Stream
mcpRouter.get('/sse', async (req: Request, res: Response) => {
  const token = extractToken(req);
  const agent = await authenticateAgentToken(token);

  if (!agent) {
    return res.status(401).json({
      error: "Unauthorized: Invalid or missing CoLearn agent token (cl_agent_...)"
    });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sessionId = crypto.randomUUID();
  sseSessions.set(sessionId, { res, agent });

  // Send initial endpoint message as per MCP SSE specification
  const endpointUrl = `/api/mcp/messages?sessionId=${sessionId}`;
  res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

  // Heartbeat ping every 25 seconds
  const pingInterval = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(pingInterval);
      sseSessions.delete(sessionId);
      return;
    }
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseSessions.delete(sessionId);
  });
});

// 2. POST /api/mcp/messages - Client JSON-RPC requests for SSE session
mcpRouter.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = sessionId ? sseSessions.get(sessionId) : null;

  let agent = session?.agent;
  if (!agent) {
    const token = extractToken(req);
    agent = (await authenticateAgentToken(token)) || undefined;
  }

  if (!agent) {
    return res.status(401).json({ error: "Session expired or invalid agent token" });
  }

  const responseJson = await handleJsonRpc(agent, req.body);

  if (session && responseJson) {
    session.res.write(`event: message\ndata: ${JSON.stringify(responseJson)}\n\n`);
    return res.status(202).send("Accepted");
  }

  return res.json(responseJson || { status: "ok" });
});

// 3. POST /api/mcp - Universal Stateless JSON-RPC 2.0 Endpoint
mcpRouter.post('/', async (req: Request, res: Response) => {
  const token = extractToken(req);
  const agent = await authenticateAgentToken(token);

  if (!agent) {
    return res.status(401).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32000,
        message: "Unauthorized: Invalid or missing CoLearn agent token"
      }
    });
  }

  const response = await handleJsonRpc(agent, req.body);
  return res.json(response);
});

// 3.5 GET /api/mcp/tools - Direct Tool Discovery Endpoint
mcpRouter.get('/tools', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: MCP_TOOLS.length,
    tools: MCP_TOOLS
  });
});

// -------------------------------------------------------------
// Admin Token Management Endpoints (Called from AdminPanel MCP Tab)
// -------------------------------------------------------------

// 4. GET /api/mcp/tokens - List tokens for current admin/university
mcpRouter.get('/tokens', async (req: Request, res: Response) => {
  try {
    const adminUid = req.query.adminUid as string;
    const university = (req.query.university as string || 'futo').toLowerCase().trim();
    const isLevel5 = req.query.isLevel5 === 'true';

    const tokensRef = collection(serverDb, 'mcp_agent_tokens');
    const snap = await getDocs(tokensRef);

    let tokens = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (!isLevel5) {
      tokens = tokens.filter(t => (t.university || 'futo').toLowerCase().trim() === university);
    }

    // Hide full raw token in listing for security
    const sanitized = tokens.map(t => ({
      id: t.id,
      tokenPrefix: t.tokenPrefix,
      name: t.name,
      university: (t.university || 'futo').toUpperCase(),
      adminUid: t.adminUid,
      adminEmail: t.adminEmail,
      level: t.level,
      status: t.status,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt || null
    }));

    sanitized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, tokens: sanitized });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/mcp/tokens/create - Create new permanent token
mcpRouter.post('/tokens/create', async (req: Request, res: Response) => {
  try {
    const { name, university, adminUid, adminEmail, level } = req.body;

    if (!name || !adminUid || !adminEmail) {
      return res.status(400).json({ success: false, error: "name, adminUid, and adminEmail are required" });
    }

    const randomSecret = crypto.randomBytes(24).toString('hex');
    const rawToken = `cl_agent_${randomSecret}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = `cl_agent_${randomSecret.slice(0, 6)}...${randomSecret.slice(-4)}`;

    const tokenId = crypto.randomUUID();
    const tokenRecord = {
      id: tokenId,
      tokenHash,
      tokenPrefix,
      name: name.trim(),
      university: (university || 'futo').toLowerCase().trim(),
      adminUid,
      adminEmail,
      level: String(level || '4'),
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    };

    await setDoc(doc(serverDb, 'mcp_agent_tokens', tokenId), tokenRecord);

    // Return the rawToken ONCE to the admin so they can copy it or download the SKILL.md
    res.json({
      success: true,
      rawToken,
      token: tokenRecord
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/mcp/tokens/revoke - Revoke a token
mcpRouter.post('/tokens/revoke', async (req: Request, res: Response) => {
  try {
    const { tokenId, adminUid, university, isLevel5 } = req.body;
    if (!tokenId) {
      return res.status(400).json({ success: false, error: "tokenId is required" });
    }

    const tokenRef = doc(serverDb, 'mcp_agent_tokens', tokenId);
    const snap = await getDoc(tokenRef);
    if (!snap.exists()) {
      return res.status(404).json({ success: false, error: "Token not found" });
    }

    const data = snap.data();
    const matchesAdmin = adminUid && data.adminUid === adminUid;
    const matchesUniversity = university && (data.university || 'futo').toLowerCase().trim() === university.toLowerCase().trim();
    if (!isLevel5 && !matchesAdmin && !matchesUniversity) {
      return res.status(403).json({ success: false, error: "You can only revoke tokens for your administrative university" });
    }

    await updateDoc(tokenRef, {
      status: 'revoked',
      revokedAt: new Date().toISOString()
    });

    res.json({ success: true, message: "Token revoked successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. GET /api/mcp/skill-template - Generate ready-to-use SKILL.md content pointing to Render backend
mcpRouter.get('/skill-template', (req: Request, res: Response) => {
  const token = (req.query.token as string) || "PASTE_YOUR_AGENT_TOKEN_HERE";
  const university = ((req.query.university as string) || "futo").toUpperCase();
  const LIVE_RENDER_URL = process.env.RENDER_BACKEND_URL || 'https://colearn-backend-tzo9.onrender.com';
  // Always default to live Render backend so the skill works instantly in Cursor/Claude Desktop
  const baseUrl = req.query.useLocal === 'true'
    ? `${req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.get('host') || 'localhost:3000'}`
    : LIVE_RENDER_URL;

  const skillMd = generateSkillMarkdown(token, university, baseUrl);

  if (req.query.download === 'true') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="COLEARN_${university}_AGENT_SKILL.md"`);
    return res.send(skillMd);
  }

  res.json({ success: true, skillMd });
});

export function generateSkillMarkdown(token: string, university: string, baseUrl: string): string {
  return `---
name: "colearn-academic-agent"
description: "Model Context Protocol (MCP) skill for autonomous curriculum creation, lecture notes authoring, and past question sheet compiling on CoLearn using official PLX markup."
---

# CoLearn Academic Agent Skill

This skill grants autonomous AI agents full capabilities to search, author, inspect, and fix university-scoped courses, lecture notes, and past question sheets on CoLearn.

## Authentication & Server Configuration

- **Target University**: \`${university}\`
- **Live Render Base URL**: \`${baseUrl}\`
- **MCP SSE Endpoint**: \`${baseUrl}/api/mcp/sse\`
- **Stateless HTTP Endpoint**: \`${baseUrl}/api/mcp\`
- **Agent Bearer Token**: \`${token}\`

### MCP Client Configuration (\`claude_desktop_config.json\` / Cursor MCP)

\`\`\`json
{
  "mcpServers": {
    "colearn": {
      "url": "${baseUrl}/api/mcp/sse",
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
    async with sse_client("${baseUrl}/api/mcp/sse", headers=headers) as (read_stream, write_stream):
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
    new URL("${baseUrl}/api/mcp/sse"),
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
Agents can also issue stateless HTTP POST calls directly to \`${baseUrl}/api/mcp\`:

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

When asked to create, review, or fix notes and past questions for \`${university}\`, follow the **Human-Hand Protocol**:

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
   - All mutations are quarantined strictly to \`${university}\`. Never attempt to alter other campuses' resources.

---

## MCP Setup & Tool Discovery for Agents

Do **NOT** attempt to write Python or Bash scripts to connect to this MCP. You are connected directly to the CoLearn MCP server.
- To discover all 15 available MCP tools and parameter schemas at runtime, call \`list_mcp_tools()\`.
- All requests use your authenticated agent token and are scoped automatically to \`${university}\`.

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
Search and pinpoint lecture notes across \`${university}\` by topic, keyword, course code, or academic level.
- **Parameters**: \`query\` (required), \`level\` (optional), \`semester\` (optional), \`courseCode\` (optional)
- **Output**: Returns matching notes with \`noteId\`, \`title\`, \`courseCode\`, \`level\`, and context \`snippet\`.

### 2. \`list_courses\`
List available academic courses for \`${university}\`.
- **Parameters**: \`level\` (optional), \`semester\` (optional), \`department\` (optional)

### 3. \`create_course\`
Create a new course under \`${university}\`.
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
