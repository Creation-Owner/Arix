export interface BuiltInKnowledgeEntry {
  id: string;
  title: string;
  category: 'coding' | 'website' | 'commands' | 'reference';
  tags: string[];
  summary: string;
  content: string;
}

export const OFFLINE_KNOWLEDGE_LIBRARY: BuiltInKnowledgeEntry[] = [
  {
    id: 'kb-react-component',
    title: 'React 19 + TypeScript + Tailwind Component & State Patterns',
    category: 'coding',
    tags: [
      'react',
      'typescript',
      'tsx',
      'usestate',
      'useeffect',
      'hooks',
      'tailwind',
      'frontend',
      'component',
      'fetch',
    ],
    summary:
      'Production React 19 functional component pattern with typed state, AbortController fetch cleanup, and Tailwind styling.',
    content: `Here is a clean, production-ready React 19 + TypeScript component pattern with proper abortable data fetching and accessible states:

\`\`\`tsx
import { useEffect, useState } from 'react';

interface Item {
  id: string;
  title: string;
  status: 'active' | 'paused';
}

export function DataPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/items', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json() as Promise<Item[]>;
      })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load items');
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) return <div className="p-4 text-slate-400">Loading...</div>;
  if (error) return <div className="p-4 text-rose-400">{error}</div>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3"
        >
          <span className="text-sm font-medium text-white">{item.title}</span>
          <span className="text-xs text-sky-400">{item.status}</span>
        </li>
      ))}
    </ul>
  );
}
\`\`\`

Key rules:
- Always cancel async fetches with \`AbortController\` in \`useEffect\` cleanup.
- Use explicit TypeScript interfaces instead of \`any\`.
- Keep derived values computed during render instead of duplicating them in state.`,
  },
  {
    id: 'kb-express-node-api',
    title: 'Node.js & Express REST API + CORS + Error Handling',
    category: 'coding',
    tags: [
      'node',
      'nodejs',
      'express',
      'api',
      'backend',
      'rest',
      'server',
      'cors',
      'json',
      'route',
      'typescript',
    ],
    summary:
      'Complete Express TypeScript API server pattern with JSON parsing, CORS headers, validation, and static serving.',
    content: `Production Express API server structure with input validation, CORS, and clean HTTP error codes:

\`\`\`ts
import express from 'express';

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/items', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) {
    res.status(400).json({ error: 'Title is required.' });
    return;
  }
  res.status(201).json({ id: Date.now().toString(36), title });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
});
\`\`\``,
  },
  {
    id: 'kb-python-fastapi',
    title: 'Python FastAPI, File Processing & Scripting Patterns',
    category: 'coding',
    tags: [
      'python',
      'fastapi',
      'flask',
      'script',
      'pip',
      'venv',
      'json',
      'pandas',
      'backend',
    ],
    summary:
      'Python virtual environment setup, FastAPI REST endpoint template, and safe JSON/file helpers.',
    content: `Python project setup and FastAPI backend template:

\`\`\`powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install fastapi uvicorn pydantic
uvicorn main:app --reload --port 8000
\`\`\`

\`\`\`python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class TaskInput(BaseModel):
    title: str
    done: bool = False

tasks: list[dict] = []

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/tasks")
def create_task(payload: TaskInput):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    record = {"id": len(tasks) + 1, "title": title, "done": payload.done}
    tasks.append(record)
    return record
\`\`\``,
  },
  {
    id: 'kb-git-powershell',
    title: 'Git, GitHub & VS Code PowerShell Sync Commands',
    category: 'commands',
    tags: [
      'git',
      'github',
      'pull',
      'push',
      'commit',
      'merge',
      'stash',
      'powershell',
      'vscode',
      'deploy',
      'conflict',
      'branch',
    ],
    summary:
      'Essential PowerShell Git workflow for pulling, pushing, fixing conflicts, and rebuilding Arix on Windows.',
    content: `Standard VS Code PowerShell Git & Arix update commands:

**1. Pull latest changes cleanly and rebuild Arix:**
\`\`\`powershell
git status
git pull origin main
npm install --legacy-peer-deps
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run app
\`\`\`

**2. If local uncommitted changes block \`git pull\`:**
\`\`\`powershell
# Option A: Discard local edits to a file (e.g. package.json)
git restore package.json
git pull origin main

# Option B: Temporarily save your local edits, pull, then reapply
git stash
git pull origin main
git stash pop
\`\`\`

**3. Commit & push your own edits to GitHub:**
\`\`\`powershell
git add .
git commit -m "Update project"
git push origin main
\`\`\`

**4. Check remote repository URL:**
\`\`\`powershell
git remote -v
\`\`\``,
  },
  {
    id: 'kb-windows-electron-npm',
    title: 'Windows Node.js, npm, Vite & Electron Desktop Troubleshooting',
    category: 'commands',
    tags: [
      'electron',
      'windows',
      'npm',
      'vite',
      'blank',
      'screen',
      'port',
      'build',
      'error',
      'peer',
      'deps',
      'cache',
      'powershell',
    ],
    summary:
      'Fixes for Windows PowerShell path quoting, npm peer dependency errors, Electron blank screen, and port conflicts.',
    content: `Common Windows + Node + Electron fixes:

1. **Always quote paths with spaces** in PowerShell:
   \`\`\`powershell
   cd "D:\\user\\main\\New folder\\arix"
   \`\`\`
2. **Peer dependency mismatch (e.g. Vite 8 / esbuild):**
   \`\`\`powershell
   npm install --legacy-peer-deps
   \`\`\`
3. **Clean rebuild when Electron opens stale or blank:**
   \`\`\`powershell
   Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
   npm run build
   npm run app
   \`\`\`
4. **Inspect Electron runtime console:** Press **\`F12\`** or **\`Ctrl + Shift + I\`** inside the Electron window.
5. **Find and kill a stuck process using port 3000 or 43120:**
   \`\`\`powershell
   netstat -ano | findstr :3000
   taskkill /PID <PID_NUMBER> /F
   \`\`\``,
  },
  {
    id: 'kb-sql-database',
    title: 'SQL (PostgreSQL & SQLite) Queries, Joins, Indexes & Safety',
    category: 'coding',
    tags: [
      'sql',
      'postgres',
      'postgresql',
      'sqlite',
      'mysql',
      'database',
      'table',
      'query',
      'join',
      'index',
      'schema',
    ],
    summary:
      'Parameterized SQL queries, table schemas, foreign keys, indexes, and aggregation patterns.',
    content: `Production SQL schema & safe query patterns:

\`\`\`sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);

-- Parameterized aggregation query (always use $1 / ? placeholders, never string concatenation)
SELECT u.email, COUNT(o.id) AS order_count, COALESCE(SUM(o.total_cents), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.role = $1
GROUP BY u.id, u.email
ORDER BY total_spent DESC
LIMIT 20;
\`\`\``,
  },
  {
    id: 'kb-cloudflare-website-widget',
    title: 'Cloudflare Tunnel, Hosting & Embedding Arix Assistant on Your Website',
    category: 'website',
    tags: [
      'cloudflare',
      'tunnel',
      'cloudflared',
      'domain',
      'dns',
      'widget',
      'embed',
      'prime-upload',
      'website',
      'https',
      'cors',
      'ssl',
      'headers',
    ],
    summary:
      'How to expose Arix over HTTPS via Cloudflare Tunnel and embed the Arix chat widget script on any live domain.',
    content: `Connecting Arix as a live Website Assistant (e.g. on a Cloudflare-hosted site):

**1. Expose your local Arix server securely via Cloudflare Tunnel (free, instant HTTPS):**
\`\`\`powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
\`\`\`
For a permanent subdomain like \`https://ai.yourdomain.com\`, create a named tunnel in Cloudflare Zero Trust Dashboard pointing to \`http://localhost:3000\`.

**2. Embed the Arix Assistant script in your website's \`index.html\` before \`</body>\`:**
\`\`\`html
<script
  src="https://YOUR-ARIX-URL/arix-widget.js"
  data-title="Arix Assistant"
  data-color="#38BDF8"
  data-position="bottom-right"
  defer
></script>
\`\`\`

**3. Recommended Website Security Headers (Cloudflare / Server):**
- \`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\`
- \`X-Content-Type-Options: nosniff\`
- \`X-Frame-Options: SAMEORIGIN\`
- \`Referrer-Policy: strict-origin-when-cross-origin\``,
  },
  {
    id: 'kb-html-css-seo-ux',
    title: 'Website UX, Accessibility (WCAG), SEO & Performance Checklist',
    category: 'website',
    tags: [
      'html',
      'css',
      'seo',
      'ux',
      'accessibility',
      'wcag',
      'a11y',
      'meta',
      'performance',
      'responsive',
      'mobile',
      'audit',
    ],
    summary:
      'High-impact P0/P1 UX, accessibility, mobile viewport, SEO meta tags, and security checklist for auditing websites.',
    content: `High-impact Website UX, Accessibility & SEO Essentials:

\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Descriptive Page Title (50–60 chars)</title>
    <meta name="description" content="Clear summary of the page (140–160 chars)." />
    <link rel="canonical" href="https://example.com/page" />
    <meta property="og:title" content="Descriptive Page Title" />
    <meta property="og:description" content="Clear summary of the page." />
  </head>
  <body>
    <header><nav aria-label="Main navigation">...</nav></header>
    <main><h1>Single Primary Heading</h1></main>
    <footer>...</footer>
  </body>
</html>
\`\`\`

Priority Audit Checklist:
- **P0 Critical**: Missing mobile viewport meta, broken navigation/forms, contrast ratio < 4.5:1, unlabeled buttons/inputs, runtime JS errors.
- **P1 High**: Images missing \`alt\` text, \`target="_blank"\` links missing \`rel="noopener noreferrer"\`, render-blocking \`<script>\` without \`defer\`/\`async\`, missing \`<html lang>\`.
- **P2 Medium**: Missing meta description, multiple or skipped heading levels (\`h1\` -> \`h3\`), missing OpenGraph/JSON-LD structured data.`,
  },
  {
    id: 'kb-local-ollama-offline-ai',
    title: 'Running a Full Local Offline LLM on Your PC with Ollama + Arix',
    category: 'commands',
    tags: [
      'ollama',
      'offline',
      'local',
      'llm',
      'llama',
      'qwen',
      'gemma',
      'deepseek',
      'mistral',
      'model',
      'no internet',
      'private',
      'gpu',
      'cpu',
    ],
    summary:
      'Install Ollama on Windows to give Arix a 100% offline, private, unlimited neural language model on your own computer.',
    content: `Arix works offline in **two layers**:
1. **Built-in Offline Knowledge Engine (Works Immediately, Zero Install):** Uses your Knowledge Vault, Taught Rules, Persona, Website Knowledge, Saved Audits, Past Chat Memory, Local File Tools, and Built-in Engineering Corpus with zero internet.
2. **Full Local Neural LLM via Ollama (Optional Upgrade for Full Conversational Offline AI):**

Install Ollama on Windows PowerShell in 2 commands:
\`\`\`powershell
winget install Ollama.Ollama
ollama pull qwen2.5-coder:7b
\`\`\`
*(Lighter 4GB RAM alternative: \`ollama pull llama3.2:3b\` or \`ollama pull gemma3:4b\`)*

Once pulled, Ollama runs locally on \`http://127.0.0.1:11434\`. Open Arix's **Offline Brain** tab, click **Scan Local PC Models**, select your model, and switch to **Auto Hybrid** or **Local PC LLM**. Arix will run with zero internet, zero API keys, and zero quota limits.`,
  },
  {
    id: 'kb-http-status-regex-security',
    title: 'HTTP Status Codes, Regex Cheatsheet & Web Security Quick Reference',
    category: 'reference',
    tags: [
      'http',
      'status',
      '400',
      '401',
      '403',
      '404',
      '429',
      '500',
      '502',
      '503',
      'regex',
      'security',
      'auth',
      'jwt',
      'xss',
      'csrf',
      'docker',
    ],
    summary:
      'Quick offline reference for HTTP status codes, common regular expressions, and security essentials.',
    content: `**HTTP Status Codes:**
- \`200 OK\` / \`201 Created\` / \`204 No Content\`: Request succeeded.
- \`301 Moved Permanently\` / \`302 Found\` / \`304 Not Modified\`: Redirect or cache hit.
- \`400 Bad Request\`: Malformed payload or failed validation.
- \`401 Unauthorized\`: Missing or invalid authentication credentials.
- \`403 Forbidden\`: Authenticated, but lacks permission.
- \`404 Not Found\`: Resource or route does not exist.
- \`429 Too Many Requests\`: Rate limit or quota reached — use exponential backoff.
- \`500 Internal Server Error\` / \`502 Bad Gateway\` / \`503 Service Unavailable\`: Server or upstream issue.

**Useful Regular Expressions:**
- Email: \`^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\`
- URL (http/https): \`^https?:\\/\\/[^\\s/$.?#].[^\\s]*$\`
- Slug: \`^[a-z0-9]+(?:-[a-z0-9]+)*$\`
- ISO Date: \`^\\d{4}-\\d{2}-\\d{2}$\`

**Web Security Essentials:**
- Never store secrets or private API keys in frontend JS/TS bundles.
- Always escape/sanitize untrusted HTML to prevent XSS.
- Use parameterized SQL queries to prevent SQL injection.
- Enforce HTTPS, CORS origin allowlists, and rate limiting on public endpoints.`,
  },
  {
    id: 'kb-arix-offline-capabilities',
    title: 'Arix Offline Mode Capabilities & Local Commands Guide',
    category: 'reference',
    tags: [
      'arix',
      'help',
      'offline',
      'commands',
      'what can you do',
      'capabilities',
      'features',
      'files',
      'teach',
      'remember',
      'calculate',
      'math',
    ],
    summary:
      'Everything Arix can do completely offline without internet access.',
    content: `When running in **Offline Mode**, Arix runs directly on your machine using its own local brain:

- **Search & Apply Your Knowledge:** Searches your **Offline Knowledge Vault**, **Taught Rules**, **Owner Persona**, **Website Knowledge**, **Saved Audits**, **Past Chat Memory**, and **Built-in Engineering Library**.
- **Teach Arix Offline:** Start any message with \`teach:\`, \`remember:\`, or \`save note:\` and Arix saves it permanently to \`data/arix-memory.json\`.
- **Inspect Your Computer Files Offline:** Ask \`list files\`, \`find file <name>\`, or \`read file <path>\` to inspect your local workspace folder directly.
- **Run Local Terminal Commands Offline:** Ask \`run command: <cmd>\` (e.g. \`run command: git status\`) to execute commands locally in your workspace.
- **Instant Math, Units & Date/Time:** Type calculations like \`(1450 * 0.18) + 250\` or \`sqrt(144) * 12\` or ask \`what time is it\`.
- **Offline Website Code Audits:** Paste HTML in **Analyze Website -> Code** to run a real local UX/SEO/Accessibility static audit offline.
- **Full Local Neural AI (Ollama / LM Studio):** If Ollama is installed on your PC, Arix automatically routes offline prompts through your local LLM with your complete memory and knowledge injected!`,
  },
];
