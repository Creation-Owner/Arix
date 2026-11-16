import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  FunctionDeclaration,
  GenerateContentResponse,
  Part,
  ThinkingLevel,
  Type,
} from '@google/genai';
import {
  ARIX_MODEL,
  extractAnswerAndThoughts,
  generateContentWithRetry,
  getGeminiClient,
} from './server/gemini.ts';
import { analyzeHtmlSignals, scrapeWebsite } from './server/scraper.ts';
import {
  createFileOrFolder,
  deleteLocalPath,
  findLocalFiles,
  listComputerEntries,
  patchLocalFile,
  readLocalFile,
  runComputerCommand,
} from './server/computer.ts';
import {
  inspectCloudflareConnection,
  inspectGitHubRepository,
  parseGitHubOwnerRepo,
  sendTelegramMessage,
  testAndSyncConnection,
  writeGitHubFile,
} from './server/connectors.ts';
import {
  addConnection,
  addCustomSection,
  addRule,
  appendChatMessages,
  clearChatHistory,
  deleteAudit,
  deleteConnection,
  deleteCustomSection,
  deleteRule,
  exportPortableBrain,
  getActiveComputerRoot,
  getConnectionToken,
  getCustomSections,
  getPublicState,
  importPortableBrain,
  resetRulesToZero,
  saveAudit,
  setComputerRootOverride,
  updateConnection,
  updateCustomSection,
  updateIssueStatus,
  updatePersona,
  updateRule,
} from './server/store.ts';
import {
  editArixSourceFile,
  inspectArixSourceFile,
} from './server/selfModify.ts';
import {
  buildPresentationDeck,
  type PresentationSlideInput,
  type PresentationThemeKey,
} from './server/presentations.ts';
import { ARIX_CORE_ENGINEERING_KNOWLEDGE } from './server/knowledge.ts';
import type {
  ArixActivityEvent,
  ArixSatelliteKey,
  AuditIssue,
  ChatAttachment,
  ChatMessage,
  ChatSource,
  ConnectedSite,
  ConnectedSiteType,
  PersonaSettings,
  ReasoningMode,
  RuleCategory,
  RuleWeight,
  TaughtRule,
  TechnicalSignals,
  WebsiteAudit,
} from './src/types/arix.ts';

if (process.env.ARIX_ENV_FILE) {
  dotenv.config({ path: process.env.ARIX_ENV_FILE });
}
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function buildArixSystemInstruction(
  persona: PersonaSettings,
  activeRules: TaughtRule[],
  connections: ConnectedSite[],
  computerRoot: string
): string {
  const rulesBlock =
    activeRules.length > 0
      ? activeRules
          .map(
            (r, idx) =>
              `${idx + 1}. [${r.weight.toUpperCase()} | ${r.category}] "${r.title}": ${r.instruction}`
          )
          .join('\n')
      : 'No custom rules taught yet. Follow standard best practices and learn directly from the owner as instructed.';

  const connectionsBlock =
    connections.length > 0
      ? connections
          .filter((c) => c.active)
          .map(
            (c) =>
              `- [${c.type.toUpperCase()}] "${c.name}" (id: ${c.id}) | Target: ${
                c.targetUrl || c.identifier
              }${c.identifier ? ` | Identifier: ${c.identifier}` : ''}${
                c.metadataSummary ? ` | Latest sync: ${c.metadataSummary}` : ''
              }`
          )
          .join('\n')
      : 'No external websites or platforms connected yet.';

  return `You are Arix, the owner's personal autonomous AI assistant for coding, software architecture, website analysis, computer file/folder management, Telegram messaging, GitHub repositories, Cloudflare infrastructure, and any technical or operational task the owner requests.

OWNER PROFILE & CORE SETTINGS FOR ARIX:
- Owner: ${persona.ownerName || 'Owner'}
- Primary Mission: ${persona.primaryGoal}
- Preferred Tech Stack: ${persona.techStack}
- Coding Style: ${persona.codingStyle}
- Preferred Response Tone: ${persona.tonePreference}
- Master Owner Directive: ${persona.customDirective || 'Follow every instruction taught by the owner.'}
- Active Computer Workspace Root: ${computerRoot}

EVERYTHING THE OWNER HAS TAUGHT YOU (ACTIVE RULES & SKILLS):
${rulesBlock}

CONNECTED PLATFORMS (WEBSITES, GITHUB, CLOUDFLARE, TELEGRAM, APIS):
${connectionsBlock}

${ARIX_CORE_ENGINEERING_KNOWLEDGE}

OPERATING & REASONING PRINCIPLES:
1. You belong exclusively to the owner. Act as a senior principal engineer, UX architect, strategist, and research analyst — think carefully from first principles before responding.
2. For every question (coding, debugging, math, architecture, strategy, writing, UX, or general knowledge), analyze root causes, edge cases, trade-offs, and constraints thoroughly, then deliver a clear, well-structured, direct answer.
3. Obey all STRICT taught rules unconditionally, prioritize PREFERRED rules, and factor in ADVISORY rules.
4. Only invoke workspace/external tools when the owner requests an action (files, presentations, Telegram, self-editing, GitHub/Cloudflare/site inspection) or when reading real evidence improves the answer — for pure thinking, explanation, or Q&A prompts, answer directly with depth and precision.
5. When the owner asks you to create, find, read, or delete files or folders on their computer, call the real filesystem tools (\`createFileOrFolder\`, \`findLocalFiles\`, \`readLocalFile\`, \`deleteLocalPath\`) and report the exact paths affected.
6. When the owner asks you to send something to Telegram, call \`sendToTelegram\` using the connected Telegram bot and report confirmation.
7. For coding tasks, deliver complete working code aligned with the owner's taught stack (${persona.techStack}) and coding style (${persona.codingStyle}).
8. For website analysis tasks, prioritize every issue by User Experience impact (P0 Critical 85-100, P1 High 65-84, P2 Medium 40-64, P3 Low 1-39) and ground findings in real evidence.`;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    raw.includes('API_KEY_INVALID') ||
    raw.includes('API key not valid') ||
    raw.includes('API key should be set')
  ) {
    return {
      status: 400,
      message: 'The configured GEMINI_API_KEY in .env was rejected by Google.',
    };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('ACCESS_TOKEN_SCOPE')) {
    return {
      status: 403,
      message: 'Permission denied by Google AI servers for this request.',
    };
  }
  if (raw.includes('NOT_FOUND')) {
    return {
      status: 404,
      message:
        'Requested Gemini model was not found or is unsupported. Verify ARIX_MODEL in server/gemini.ts.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('"code":429')) {
    return {
      status: 429,
      message:
        'Google AI servers are temporarily busy (your current Google plan quota limit was reached). Wait 10–15 seconds and send your message again.',
    };
  }
  return { status: 500, message: raw || 'Unexpected error calling Arix AI.' };
}

const saveTaughtRuleDeclaration: FunctionDeclaration = {
  name: 'saveTaughtRule',
  description:
    'Permanently teach Arix a new rule, coding standard, skill, prioritization preference, or owner behavior instruction.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Concise 3-8 word title summarizing what Arix learned.',
      },
      instruction: {
        type: Type.STRING,
        description: 'Exact full instruction or rule for Arix to follow.',
      },
      category: {
        type: Type.STRING,
        description:
          'One of: coding, analysis_ux, connections, automation, owner_directive',
      },
      weight: {
        type: Type.STRING,
        description: 'One of: strict, preferred, advisory',
      },
    },
    required: ['title', 'instruction', 'category', 'weight'],
  },
};

const inspectConnectedSiteDeclaration: FunctionDeclaration = {
  name: 'inspectConnectedSite',
  description:
    'Fetch live HTTP status, headers, DOM signals, and page content from a website URL or connected endpoint.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'Full http/https URL to inspect.',
      },
    },
    required: ['url'],
  },
};

const inspectGitHubRepoDeclaration: FunctionDeclaration = {
  name: 'inspectGitHubRepo',
  description:
    'Inspect a GitHub repository (metadata, file tree, or read a specific source file).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      repo: {
        type: Type.STRING,
        description: 'GitHub repo in "owner/repo" format or full GitHub URL.',
      },
      filePath: {
        type: Type.STRING,
        description: 'Optional relative file path inside the repo to read.',
      },
    },
    required: ['repo'],
  },
};

const writeGitHubFileDeclaration: FunctionDeclaration = {
  name: 'writeGitHubFile',
  description:
    'Create or update a file inside a connected GitHub repository using the stored GitHub token (commits directly via GitHub Contents API).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      repo: {
        type: Type.STRING,
        description:
          'GitHub repo in "owner/repo" format or full GitHub URL. If the owner says "my GitHub", pass the connected GitHub repo identifier.',
      },
      filePath: {
        type: Type.STRING,
        description:
          'Relative file path inside the repository (e.g., "notes/update.md" or "src/hello.ts").',
      },
      content: {
        type: Type.STRING,
        description: 'Complete UTF-8 text content of the file to write.',
      },
      commitMessage: {
        type: Type.STRING,
        description: 'Short Git commit message describing the addition or edit.',
      },
      branch: {
        type: Type.STRING,
        description: 'Optional branch name (defaults to repository default branch).',
      },
    },
    required: ['filePath', 'content'],
  },
};

const inspectCloudflareDomainDeclaration: FunctionDeclaration = {
  name: 'inspectCloudflareDomain',
  description:
    'Inspect live Cloudflare DNS records, edge headers, and zone status for a domain.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      domainOrUrl: {
        type: Type.STRING,
        description: 'Domain name or URL.',
      },
    },
    required: ['domainOrUrl'],
  },
};

const listComputerFolderDeclaration: FunctionDeclaration = {
  name: 'listComputerFolder',
  description:
    'List all files and subfolders inside a directory of the host computer workspace root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subDir: {
        type: Type.STRING,
        description:
          'Optional relative subfolder path (leave empty or "." for workspace root).',
      },
    },
  },
};

const createFileOrFolderDeclaration: FunctionDeclaration = {
  name: 'createFileOrFolder',
  description:
    'Create a new file (with optional content) or folder inside the host computer workspace root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPath: {
        type: Type.STRING,
        description:
          'Relative path inside the computer root (e.g. "notes/todo.txt" or "projects/my-app").',
      },
      kind: {
        type: Type.STRING,
        description: 'Must be "file" or "folder".',
      },
      content: {
        type: Type.STRING,
        description: 'File text contents when kind is "file".',
      },
    },
    required: ['targetPath', 'kind'],
  },
};

const patchLocalFileDeclaration: FunctionDeclaration = {
  name: 'patchLocalFile',
  description:
    'Surgically edit an existing file inside the host computer workspace by replacing an exact snippet without rewriting unrelated code.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPath: {
        type: Type.STRING,
        description: 'Relative path to the existing file.',
      },
      findText: {
        type: Type.STRING,
        description: 'Exact existing snippet inside the file to replace.',
      },
      replaceText: {
        type: Type.STRING,
        description: 'Replacement snippet.',
      },
      replaceAll: {
        type: Type.BOOLEAN,
        description: 'Set true to replace all occurrences.',
      },
    },
    required: ['targetPath', 'findText', 'replaceText'],
  },
};

const findLocalFilesDeclaration: FunctionDeclaration = {
  name: 'findLocalFiles',
  description:
    'Search files and folders inside the host computer workspace root by filename or text content.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Filename, extension, or text phrase to search for.',
      },
    },
    required: ['query'],
  },
};

const readLocalFileDeclaration: FunctionDeclaration = {
  name: 'readLocalFile',
  description: 'Read the contents of a file inside the host computer workspace root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPath: {
        type: Type.STRING,
        description: 'Relative path of the file to read.',
      },
    },
    required: ['targetPath'],
  },
};

const deleteLocalPathDeclaration: FunctionDeclaration = {
  name: 'deleteLocalPath',
  description:
    'Delete a file or folder inside the host computer workspace root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPath: {
        type: Type.STRING,
        description: 'Relative path of the file or folder to delete.',
      },
    },
    required: ['targetPath'],
  },
};

const runComputerCommandDeclaration: FunctionDeclaration = {
  name: 'runComputerCommand',
  description:
    'Execute a shell command (such as npm run build, tsc --noEmit, node script.js, python app.py, git status, tests) inside the host computer workspace root and inspect stdout/stderr.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: 'Shell command to execute inside the workspace.',
      },
      subDir: {
        type: Type.STRING,
        description: 'Optional relative subfolder to run the command inside.',
      },
    },
    required: ['command'],
  },
};

const sendToTelegramDeclaration: FunctionDeclaration = {
  name: 'sendToTelegram',
  description:
    'Send a message to a connected Telegram bot/chat.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description: 'Message text to deliver to Telegram.',
      },
      connectionId: {
        type: Type.STRING,
        description: 'Optional ID of a specific connected Telegram bot.',
      },
      chatId: {
        type: Type.STRING,
        description: 'Optional override Chat ID if different from the connected default.',
      },
    },
    required: ['message'],
  },
};

const createSelfSectionDeclaration: FunctionDeclaration = {
  name: 'createSelfSection',
  description:
    'Create a brand-new live interactive section/tab inside Arix itself (HTML + CSS + JS) so Arix expands its own UI and tools whenever the owner teaches it coding or asks it to add a feature/section.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Clear heading for the new section inside Arix.',
      },
      navLabel: {
        type: Type.STRING,
        description: 'Short 1-3 word label shown in Arix sidebar navigation.',
      },
      description: {
        type: Type.STRING,
        description: 'Short description of what this self-built section does.',
      },
      placement: {
        type: Type.STRING,
        description: 'One of: sidebar_tab, main_page, both (default sidebar_tab).',
      },
      htmlCode: {
        type: Type.STRING,
        description:
          'Complete self-contained HTML5 snippet (style + markup + script) styled cleanly in dark navy (#060E1F / #0B152B / #38BDF8 sky accents) implementing the interactive tool or section.',
      },
    },
    required: ['title', 'navLabel', 'htmlCode'],
  },
};

const updateSelfSectionDeclaration: FunctionDeclaration = {
  name: 'updateSelfSection',
  description:
    'Update an existing self-built section inside Arix by its ID or title.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      idOrTitle: {
        type: Type.STRING,
        description: 'ID, title, or navLabel of the existing section to modify.',
      },
      title: { type: Type.STRING },
      navLabel: { type: Type.STRING },
      description: { type: Type.STRING },
      placement: { type: Type.STRING },
      htmlCode: { type: Type.STRING },
    },
    required: ['idOrTitle'],
  },
};

const deleteSelfSectionDeclaration: FunctionDeclaration = {
  name: 'deleteSelfSection',
  description: 'Delete a self-built section from Arix by ID or title.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      idOrTitle: {
        type: Type.STRING,
        description: 'ID or title of the self-built section to delete.',
      },
    },
    required: ['idOrTitle'],
  },
};

const inspectArixSourceFileDeclaration: FunctionDeclaration = {
  name: 'inspectArixSourceFile',
  description:
    'Inspect Arix own source files (e.g. "." to list files, or "src/App.tsx", "server.ts") so Arix understands its own codebase.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: 'Relative path inside Arix project (pass "." to list files).',
      },
    },
    required: ['filePath'],
  },
};

const editArixSourceFileDeclaration: FunctionDeclaration = {
  name: 'editArixSourceFile',
  description:
    'Modify or create a source file inside Arix own project (src/, server/, public/, electron/) with automatic backup in data/self-backups/.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: 'Relative path inside src/, server/, public/, or electron/.',
      },
      content: {
        type: Type.STRING,
        description: 'Complete file content to write.',
      },
      reason: {
        type: Type.STRING,
        description: 'Brief note explaining the self-modification.',
      },
    },
    required: ['filePath', 'content'],
  },
};

const createPresentationDeclaration: FunctionDeclaration = {
  name: 'createPresentation',
  description:
    'Create a real PowerPoint (.pptx) presentation saved to the computer workspace (presentations/<file>.pptx) AND open an interactive Slide Deck viewer inside Arix with speaker notes, keyboard navigation, fullscreen mode, and a Download .pptx button.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Presentation title.',
      },
      subtitle: {
        type: Type.STRING,
        description: 'Optional subtitle or presenter line.',
      },
      theme: {
        type: Type.STRING,
        description:
          'Visual palette: "midnight_blue", "clean_light", "executive_slate", or "emerald_tech".',
      },
      fileName: {
        type: Type.STRING,
        description: 'Optional .pptx file name (e.g., "ai-automation.pptx").',
      },
      placement: {
        type: Type.STRING,
        description:
          'Where to show interactive viewer inside Arix: "both" (default), "sidebar_tab", or "main_page".',
      },
      saveInteractiveSection: {
        type: Type.BOOLEAN,
        description:
          'Whether to create an interactive Slide Deck section inside Arix UI (default true).',
      },
      slides: {
        type: Type.ARRAY,
        description: 'Ordered list of slides for the presentation.',
        items: {
          type: Type.OBJECT,
          properties: {
            layout: {
              type: Type.STRING,
              description:
                'One of: "title", "bullets", "two_column", "metrics", "quote".',
            },
            heading: {
              type: Type.STRING,
              description: 'Slide headline.',
            },
            subheading: {
              type: Type.STRING,
              description: 'Optional short subtitle on the slide.',
            },
            bullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Concise bullet points for the slide.',
            },
            leftHeading: { type: Type.STRING },
            leftItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            rightHeading: { type: Type.STRING },
            rightItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            metrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  detail: { type: Type.STRING },
                },
              },
            },
            quote: { type: Type.STRING },
            quoteAuthor: { type: Type.STRING },
            notes: {
              type: Type.STRING,
              description: 'Speaker notes for the presenter.',
            },
          },
          required: ['heading'],
        },
      },
    },
    required: ['title', 'slides'],
  },
};

const sseClients = new Set<express.Response>();
const recentActivityEvents: ArixActivityEvent[] = [];

function emitArixActivity(
  event: Omit<ArixActivityEvent, 'id' | 'timestamp'>
): ArixActivityEvent {
  const full: ArixActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  recentActivityEvents.push(full);
  if (recentActivityEvents.length > 25) {
    recentActivityEvents.splice(0, recentActivityEvents.length - 25);
  }
  const payload = `data: ${JSON.stringify(full)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
  return full;
}

function mapToolToNode(toolName: string): ArixSatelliteKey {
  switch (toolName) {
    case 'inspectGitHubRepo':
    case 'writeGitHubFile':
    case 'inspectConnectedSite':
    case 'inspectArixSourceFile':
    case 'editArixSourceFile':
      return 'code';
    case 'listComputerFolder':
    case 'createFileOrFolder':
    case 'patchLocalFile':
    case 'findLocalFiles':
    case 'readLocalFile':
    case 'deleteLocalPath':
    case 'runComputerCommand':
    case 'inspectCloudflareDomain':
      return 'compute';
    case 'saveTaughtRule':
    case 'createSelfSection':
    case 'updateSelfSection':
    case 'deleteSelfSection':
    case 'createPresentation':
      return 'text';
    case 'sendToTelegram':
      return 'network';
    default:
      return 'core';
  }
}

function formatToolStartDetail(
  toolName: string,
  args: Record<string, unknown>
): { title: string; detail: string } {
  switch (toolName) {
    case 'writeGitHubFile':
      return {
        title: 'GitHub · Writing file',
        detail: `Committing ${String(args.filePath || 'file')} to ${String(
          args.repo || 'connected GitHub repo'
        )}...`,
      };
    case 'inspectGitHubRepo':
      return {
        title: 'GitHub · Inspecting repo',
        detail: `Reading ${String(args.repo || 'connected repository')}${
          args.filePath ? `/${String(args.filePath)}` : ''
        }...`,
      };
    case 'inspectConnectedSite':
      return {
        title: 'Code & Web · Scanning site',
        detail: `Fetching ${String(args.url || 'target URL')}...`,
      };
    case 'createSelfSection':
      return {
        title: 'Arix Self-Build · Adding section',
        detail: `Building "${String(args.title || args.navLabel || 'New Section')}" inside Arix...`,
      };
    case 'updateSelfSection':
      return {
        title: 'Arix Self-Build · Updating',
        detail: `Updating "${String(args.idOrTitle || 'section')}"...`,
      };
    case 'deleteSelfSection':
      return {
        title: 'Arix Self-Build · Removing',
        detail: `Removing "${String(args.idOrTitle || 'section')}"...`,
      };
    case 'inspectArixSourceFile':
      return {
        title: 'Self-Code · Reading',
        detail: `Inspecting ${String(args.filePath || '.')}...`,
      };
    case 'editArixSourceFile':
      return {
        title: 'Self-Code · Modifying',
        detail: `Updating ${String(args.filePath || 'source file')}...`,
      };
    case 'listComputerFolder':
      return {
        title: 'Computer · Listing folder',
        detail: `Listing "${String(args.subDir || '.')}"...`,
      };
    case 'createFileOrFolder':
      return {
        title: 'Computer · Creating',
        detail: `Creating ${String(args.kind || 'file')} "${String(
          args.targetPath || ''
        )}"...`,
      };
    case 'patchLocalFile':
      return {
        title: 'Computer · Patching file',
        detail: `Applying surgical edit to "${String(args.targetPath || '')}"...`,
      };
    case 'findLocalFiles':
      return {
        title: 'Computer · Searching',
        detail: `Searching files for "${String(args.query || '')}"...`,
      };
    case 'readLocalFile':
      return {
        title: 'Computer · Reading file',
        detail: `Reading "${String(args.targetPath || '')}"...`,
      };
    case 'deleteLocalPath':
      return {
        title: 'Computer · Deleting',
        detail: `Removing "${String(args.targetPath || '')}"...`,
      };
    case 'runComputerCommand':
      return {
        title: 'Terminal · Running command',
        detail: `Running "${String(args.command || '').slice(0, 80)}"...`,
      };
    case 'inspectCloudflareDomain':
      return {
        title: 'Cloudflare · Checking edge',
        detail: `Querying DNS & edge headers for ${String(
          args.domainOrUrl || 'domain'
        )}...`,
      };
    case 'sendToTelegram':
      return {
        title: 'Telegram · Sending message',
        detail: 'Delivering message via connected Telegram bot...',
      };
    case 'saveTaughtRule':
      return {
        title: 'Memory · Learning rule',
        detail: `Saving "${String(args.title || 'Owner Instruction')}"...`,
      };
    case 'createPresentation':
      return {
        title: 'Presentation · Building slides',
        detail: `Creating "${String(args.title || 'Presentation')}" (.pptx + viewer)...`,
      };
    default:
      return {
        title: 'Arix · Running tool',
        detail: `Executing ${toolName}...`,
      };
  }
}

function formatToolDoneTitle(toolName: string): string {
  switch (toolName) {
    case 'listComputerFolder':
      return 'Computer · Listed';
    case 'createFileOrFolder':
      return 'Computer · Saved';
    case 'patchLocalFile':
      return 'Computer · Patched';
    case 'findLocalFiles':
      return 'Computer · Search done';
    case 'readLocalFile':
      return 'Computer · File read';
    case 'deleteLocalPath':
      return 'Computer · Removed';
    case 'runComputerCommand':
      return 'Terminal · Command finished';
    case 'saveTaughtRule':
      return 'Memory · Rule learned';
    case 'createSelfSection':
      return 'Arix Self-Build · Added';
    case 'updateSelfSection':
      return 'Arix Self-Build · Updated';
    case 'deleteSelfSection':
      return 'Arix Self-Build · Removed';
    case 'createPresentation':
      return 'Presentation · Ready (.pptx)';
    case 'inspectArixSourceFile':
      return 'Self-Code · Read';
    case 'editArixSourceFile':
      return 'Self-Code · Updated';
    case 'inspectConnectedSite':
      return 'Code & Web · Scanned';
    case 'sendToTelegram':
      return 'Telegram · Delivered';
    default:
      return `Arix · ${toolName} done`;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ai: 'Arix' });
  });

  app.get('/api/presentations/:fileName', (req, res) => {
    try {
      const safeName = path.basename(String(req.params.fileName || ''));
      if (!safeName.toLowerCase().endsWith('.pptx')) {
        res.status(400).json({ error: 'Only .pptx files can be downloaded.' });
        return;
      }
      const rootDir = getActiveComputerRoot();
      const presDir = path.resolve(rootDir, 'presentations');
      const fullPath = path.resolve(presDir, safeName);
      if (!fullPath.startsWith(presDir) || !fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Presentation file not found.' });
        return;
      }
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.download(fullPath, safeName);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to download presentation.',
      });
    }
  });

  app.get('/api/activity/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const snapshot = recentActivityEvents.slice(-8);
    res.write(
      `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`
    );

    sseClients.add(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json(getPublicState());
  });

  // Computer Files & Folders API
  app.get('/api/computer/files', (req, res) => {
    try {
      const rootDir = getActiveComputerRoot();
      const subPath = req.query.path ? String(req.query.path) : '';
      const result = listComputerEntries(rootDir, subPath);
      res.json({ rootDir, ...result });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Unable to list directory.',
      });
    }
  });

  app.get('/api/computer/read', (req, res) => {
    try {
      const rootDir = getActiveComputerRoot();
      const targetPath = String(req.query.path || '');
      res.json(readLocalFile(rootDir, targetPath));
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to read file.',
      });
    }
  });

  app.get('/api/computer/find', (req, res) => {
    try {
      const rootDir = getActiveComputerRoot();
      const q = String(req.query.q || '');
      res.json({ rootDir, matches: findLocalFiles(rootDir, q) });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Search failed.',
      });
    }
  });

  app.put('/api/computer/root', (req, res) => {
    try {
      const newRoot = String(req.body?.rootPath || '');
      const resolved = setComputerRootOverride(newRoot);
      res.json({ computerRoot: resolved });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to set computer root path.',
      });
    }
  });

  app.post('/api/computer/create', (req, res) => {
    try {
      const rootDir = getActiveComputerRoot();
      const { targetPath, kind, content } = req.body ?? {};
      emitArixActivity({
        phase: 'tool_start',
        node: 'compute',
        toolName: 'createFileOrFolder',
        title: 'Computer · Creating',
        detail: `Creating ${kind === 'folder' ? 'folder' : 'file'} "${String(targetPath || '')}"`,
      });
      const result = createFileOrFolder(rootDir, {
        targetPath: String(targetPath || ''),
        kind: kind === 'folder' ? 'folder' : 'file',
        content: content !== undefined ? String(content) : undefined,
      });
      emitArixActivity({
        phase: 'tool_done',
        node: 'compute',
        toolName: 'createFileOrFolder',
        title: 'Computer · Created',
        detail: `Saved "${result.createdPath}" on workspace`,
      });
      res.status(201).json(result);
    } catch (err) {
      emitArixActivity({
        phase: 'error',
        node: 'compute',
        toolName: 'createFileOrFolder',
        title: 'Computer · Error',
        detail:
          err instanceof Error ? err.message : 'Failed to create file/folder.',
      });
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Failed to create file/folder.',
      });
    }
  });

  app.delete('/api/computer/item', (req, res) => {
    try {
      const rootDir = getActiveComputerRoot();
      const targetPath = String(req.body?.targetPath || req.query.path || '');
      emitArixActivity({
        phase: 'tool_start',
        node: 'compute',
        toolName: 'deleteLocalPath',
        title: 'Computer · Deleting',
        detail: `Removing "${targetPath}"...`,
      });
      const result = deleteLocalPath(rootDir, targetPath);
      emitArixActivity({
        phase: 'tool_done',
        node: 'compute',
        toolName: 'deleteLocalPath',
        title: 'Computer · Deleted',
        detail: `Removed "${result.deletedPath}"`,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to delete item.',
      });
    }
  });

  // Rules / Teach Arix CRUD
  app.post('/api/rules', (req, res) => {
    const { title, instruction, category, weight } = req.body ?? {};
    if (!title?.trim() || !instruction?.trim()) {
      res
        .status(400)
        .json({ error: 'Both rule title and instruction are required.' });
      return;
    }
    const validCategories: RuleCategory[] = [
      'coding',
      'analysis_ux',
      'connections',
      'automation',
      'owner_directive',
    ];
    const validWeights: RuleWeight[] = ['strict', 'preferred', 'advisory'];
    const rule = addRule({
      title: String(title).trim(),
      instruction: String(instruction).trim(),
      category: validCategories.includes(category) ? category : 'owner_directive',
      weight: validWeights.includes(weight) ? weight : 'strict',
      active: true,
      source: 'manual',
    });
    res.status(201).json(rule);
  });

  app.post('/api/rules/reset', (_req, res) => {
    resetRulesToZero();
    res.json({ reset: true });
  });

  app.patch('/api/rules/:id', (req, res) => {
    const updated = updateRule(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Rule not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/rules/:id', (req, res) => {
    const ok = deleteRule(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Rule not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.put('/api/persona', (req, res) => {
    const updated = updatePersona(req.body ?? {});
    res.json(updated);
  });

  app.get('/api/brain/export', (_req, res) => {
    res.json(exportPortableBrain());
  });

  app.post('/api/brain/import', (req, res) => {
    const result = importPortableBrain(req.body ?? {});
    res.json({ ...result, state: getPublicState() });
  });

  // Self-Built Sections CRUD
  app.post('/api/sections', (req, res) => {
    const { title, navLabel, description, placement, htmlCode } = req.body ?? {};
    if (!title?.trim() || !htmlCode?.trim()) {
      res.status(400).json({ error: 'Section title and htmlCode are required.' });
      return;
    }
    const created = addCustomSection({
      title: String(title).trim(),
      navLabel: String(navLabel || title).trim().slice(0, 24),
      description: String(description || '').trim(),
      placement:
        placement === 'main_page' || placement === 'both'
          ? placement
          : 'sidebar_tab',
      htmlCode: String(htmlCode),
    });
    res.status(201).json(created);
  });

  app.patch('/api/sections/:id', (req, res) => {
    const updated = updateCustomSection(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/sections/:id', (req, res) => {
    const ok = deleteCustomSection(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Connected Websites & Services (Website, GitHub, Cloudflare, Telegram, API)
  app.post('/api/connections', async (req, res) => {
    try {
      const { name, type, targetUrl, identifier, token } = req.body ?? {};
      const validTypes: ConnectedSiteType[] = [
        'website',
        'github',
        'cloudflare',
        'telegram',
        'api',
      ];
      const connType: ConnectedSiteType = validTypes.includes(type)
        ? type
        : 'website';

      const cleanTarget = String(targetUrl || '').trim();
      const cleanIdent = String(identifier || '').trim();
      const cleanToken = token ? String(token).trim() : '';

      if (connType === 'telegram' && !cleanToken) {
        res.status(400).json({
          error: 'Please enter your Telegram Bot Token from @BotFather.',
        });
        return;
      }
      if (connType !== 'telegram' && !cleanTarget && !cleanIdent) {
        res
          .status(400)
          .json({ error: 'Please provide a URL, repository, or domain.' });
        return;
      }

      const sync = await testAndSyncConnection({
        type: connType,
        targetUrl: cleanTarget,
        identifier: cleanIdent,
        token: cleanToken || undefined,
      });

      const created = addConnection(
        {
          name:
            String(name || '').trim() ||
            (connType === 'telegram'
              ? 'Telegram Bot'
              : sync.normalizedIdentifier || cleanIdent || cleanTarget),
          type: connType,
          targetUrl: sync.normalizedTargetUrl || cleanTarget,
          identifier: sync.normalizedIdentifier || cleanIdent,
          hasToken: Boolean(cleanToken),
          active: true,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: sync.statusText,
          metadataSummary: sync.metadataSummary,
        },
        cleanToken || undefined
      );

      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to add connection.',
      });
    }
  });

  app.post('/api/connections/:id/sync', async (req, res) => {
    const state = getPublicState();
    const existing = state.connections.find((c) => c.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Connection not found.' });
      return;
    }
    const syncNode: ArixSatelliteKey =
      existing.type === 'telegram'
        ? 'network'
        : existing.type === 'cloudflare'
          ? 'compute'
          : 'code';
    emitArixActivity({
      phase: 'tool_start',
      node: syncNode,
      title: `Syncing ${existing.type.toUpperCase()}`,
      detail: `Testing ${existing.name}...`,
    });
    const token = getConnectionToken(existing.id);
    const sync = await testAndSyncConnection({
      type: existing.type,
      targetUrl: existing.targetUrl,
      identifier: existing.identifier,
      token,
    });
    const updated = updateConnection(existing.id, {
      lastSyncedAt: new Date().toISOString(),
      lastStatus: sync.statusText,
      metadataSummary: sync.metadataSummary,
      ...(sync.normalizedTargetUrl ? { targetUrl: sync.normalizedTargetUrl } : {}),
      ...(sync.normalizedIdentifier ? { identifier: sync.normalizedIdentifier } : {}),
    });
    emitArixActivity({
      phase: 'tool_done',
      node: syncNode,
      title: `${existing.name} · ${sync.statusText}`,
      detail: sync.metadataSummary,
    });
    res.json(updated);
  });

  app.patch('/api/connections/:id', (req, res) => {
    const { token, ...rest } = req.body ?? {};
    const updated = updateConnection(
      req.params.id,
      rest,
      token !== undefined ? String(token) : undefined
    );
    if (!updated) {
      res.status(404).json({ error: 'Connection not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/connections/:id', (req, res) => {
    const ok = deleteConnection(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Connection not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Direct Telegram Send endpoint (for testing or UI quick send)
  app.post('/api/telegram/send', async (req, res) => {
    const { connectionId, message, chatId } = req.body ?? {};
    const state = getPublicState();
    const tgConn = connectionId
      ? state.connections.find(
          (c) => c.id === connectionId && c.type === 'telegram'
        )
      : state.connections.find((c) => c.type === 'telegram' && c.active);

    if (!tgConn) {
      res.status(400).json({ error: 'No connected Telegram bot found.' });
      return;
    }
    const token = getConnectionToken(tgConn.id);
    const resolvedChatId = String(chatId || tgConn.identifier || '').trim();
    if (!token || !resolvedChatId) {
      res.status(400).json({
        error:
          'Missing Telegram Bot Token or Chat ID. Send /start to your bot and click Sync first.',
      });
      return;
    }
    emitArixActivity({
      phase: 'tool_start',
      node: 'network',
      toolName: 'sendToTelegram',
      title: 'Telegram · Sending',
      detail: `Delivering message to ${tgConn.name}...`,
    });
    const result = await sendTelegramMessage(
      token,
      resolvedChatId,
      String(message || 'Test message from Arix AI.')
    );
    if (!result.ok) {
      emitArixActivity({
        phase: 'error',
        node: 'network',
        toolName: 'sendToTelegram',
        title: 'Telegram · Failed',
        detail: result.error || 'Telegram send failed.',
      });
      res.status(400).json({ error: result.error });
      return;
    }
    emitArixActivity({
      phase: 'tool_done',
      node: 'network',
      toolName: 'sendToTelegram',
      title: 'Telegram · Sent',
      detail: `Delivered message #${result.messageId || 'ok'} via ${tgConn.name}`,
    });
    res.json(result);
  });

  // Analyze Website
  app.post('/api/analyze', async (req, res) => {
    try {
      const {
        inputType = 'url',
        url,
        code,
        notes,
        screenshotBase64,
        screenshotMimeType,
        connectionId,
      } = req.body ?? {};

      const state = getPublicState();
      const activeRules = state.rules.filter((r) => r.active);
      const ai = getGeminiClient();

      emitArixActivity({
        phase: 'thinking',
        node: 'text',
        title: 'Website Audit · Starting',
        detail: `Preparing UX & error analysis (${inputType})...`,
      });

      let technicalSignals: TechnicalSignals | undefined;
      let htmlExcerpt = '';
      let textExcerpt = '';
      let extraConnectionContext = '';
      let urlContextSummary = '';
      let targetLabel = '';

      const linkedConnection = connectionId
        ? state.connections.find((c) => c.id === connectionId)
        : undefined;

      if (linkedConnection?.type === 'telegram' && !url?.trim()) {
        res.status(400).json({
          error:
            'Telegram bots are messaging channels. Please pick a Website, GitHub, or Cloudflare connection or enter a URL.',
        });
        return;
      }

      const effectiveUrl =
        url && String(url).trim()
          ? String(url).trim()
          : linkedConnection?.type !== 'telegram'
            ? linkedConnection?.targetUrl || ''
            : '';

      if (linkedConnection?.type === 'github') {
        const parsed = parseGitHubOwnerRepo(
          linkedConnection.identifier || linkedConnection.targetUrl
        );
        if (parsed) {
          const token = getConnectionToken(linkedConnection.id);
          const gh = await inspectGitHubRepository(
            parsed.owner,
            parsed.repo,
            token
          );
          extraConnectionContext = `Connected GitHub Repo Inspection:\n${gh.summary}\n${JSON.stringify(
            gh.data || {},
            null,
            2
          ).slice(0, 6000)}`;
          targetLabel = `GitHub: ${parsed.owner}/${parsed.repo}`;
        }
      } else if (linkedConnection?.type === 'cloudflare') {
        const token = getConnectionToken(linkedConnection.id);
        const cf = await inspectCloudflareConnection(
          linkedConnection.targetUrl || linkedConnection.identifier,
          linkedConnection.identifier && !linkedConnection.identifier.includes('.')
            ? linkedConnection.identifier
            : undefined,
          token
        );
        extraConnectionContext = `Connected Cloudflare Inspection:\n${cf.summary}\n${JSON.stringify(
          cf.data || {},
          null,
          2
        ).slice(0, 6000)}`;
      }

      if (
        (inputType === 'url' || effectiveUrl) &&
        linkedConnection?.type !== 'github'
      ) {
        if (!effectiveUrl) {
          res.status(400).json({ error: 'Please enter a website URL to analyze.' });
          return;
        }
        const scraped = await scrapeWebsite(effectiveUrl);
        technicalSignals = scraped.signals;
        htmlExcerpt = scraped.htmlExcerpt;
        textExcerpt = scraped.textExcerpt;
        targetLabel = targetLabel || scraped.signals.fetchedUrl || effectiveUrl;

        if (!htmlExcerpt || textExcerpt.length < 250) {
          try {
            const urlResp = await generateContentWithRetry(ai, {
              model: ARIX_MODEL,
              contents: `Inspect the webpage at ${targetLabel}. Describe its layout, navigation, headings, forms, CTAs, visible errors, loading/performance clues, and UX issues.`,
              config: { tools: [{ urlContext: {} }] },
            });
            if (urlResp.text) {
              urlContextSummary = urlResp.text.slice(0, 8000);
            }
          } catch {
            // Continue with scrape signals
          }
        }
      } else if (inputType === 'code') {
        const rawCode = String(code || '').trim();
        if (!rawCode) {
          res.status(400).json({
            error: 'Please paste HTML, JSX, or source code for Arix to analyze.',
          });
          return;
        }
        const parsed = analyzeHtmlSignals(rawCode);
        technicalSignals = parsed.signals;
        htmlExcerpt = rawCode.slice(0, 18000);
        textExcerpt = parsed.textExcerpt;
        targetLabel = notes?.trim()
          ? `Code Audit: ${String(notes).trim().slice(0, 48)}`
          : 'Pasted Code Snippet';
      } else if (inputType === 'screenshot') {
        if (!screenshotBase64) {
          res
            .status(400)
            .json({ error: 'Please upload a screenshot for Arix to inspect.' });
          return;
        }
        targetLabel = notes?.trim()
          ? `Visual Audit: ${String(notes).trim().slice(0, 48)}`
          : 'Screenshot Visual Audit';
      }

      const systemInstruction = buildArixSystemInstruction(
        state.persona,
        activeRules,
        state.connections,
        state.computerRoot
      );

      const promptSections: string[] = [
        `Perform a complete website & UX impact audit as Arix.`,
        `Target: ${targetLabel}`,
        notes ? `Owner Focus Notes: ${String(notes)}` : '',
        extraConnectionContext,
        technicalSignals
          ? `Measured Technical & DOM Signals:\n${JSON.stringify(technicalSignals, null, 2)}`
          : '',
        textExcerpt ? `Visible Page Copy Excerpt:\n${textExcerpt}` : '',
        htmlExcerpt ? `HTML / Source Code Excerpt:\n${htmlExcerpt}` : '',
        urlContextSummary ? `Live URL Context Notes:\n${urlContextSummary}` : '',
        `Return 4 to 9 concrete, non-redundant issues sorted from highest uxImpactScore to lowest. Provide complete Before/After code fixes aligned with the owner's taught stack and rules.`,
      ].filter(Boolean);

      const parts: Part[] = [];
      if (screenshotBase64 && screenshotMimeType) {
        parts.push({
          inlineData: {
            mimeType: String(screenshotMimeType),
            data: String(screenshotBase64),
          },
        });
      }
      parts.push({ text: promptSections.join('\n\n') });

      const response: GenerateContentResponse = await generateContentWithRetry(
        ai,
        {
          model: ARIX_MODEL,
          contents: { parts },
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
            responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              targetLabel: { type: Type.STRING },
              summary: { type: Type.STRING },
              uxPrioritizationRationale: { type: Type.STRING },
              appliedRulesUsed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    uxImpactScore: { type: Type.INTEGER },
                    category: { type: Type.STRING },
                    affectedArea: { type: Type.STRING },
                    userExperienceImpact: { type: Type.STRING },
                    evidence: { type: Type.STRING },
                    solutionSummary: { type: Type.STRING },
                    beforeCode: { type: Type.STRING },
                    afterCode: { type: Type.STRING },
                    matchedTaughtRule: { type: Type.STRING },
                    impactDimensions: {
                      type: Type.OBJECT,
                      properties: {
                        taskCompletion: { type: Type.INTEGER },
                        accessibility: { type: Type.INTEGER },
                        perceivedSpeed: { type: Type.INTEGER },
                        trustAndClarity: { type: Type.INTEGER },
                      },
                      required: [
                        'taskCompletion',
                        'accessibility',
                        'perceivedSpeed',
                        'trustAndClarity',
                      ],
                    },
                  },
                  required: [
                    'title',
                    'priority',
                    'uxImpactScore',
                    'category',
                    'affectedArea',
                    'userExperienceImpact',
                    'evidence',
                    'solutionSummary',
                    'beforeCode',
                    'afterCode',
                    'matchedTaughtRule',
                    'impactDimensions',
                  ],
                },
              },
            },
            required: [
              'targetLabel',
              'summary',
              'uxPrioritizationRationale',
              'appliedRulesUsed',
              'issues',
            ],
          },
          },
        }
      );

      const parsed = JSON.parse(response.text || '{}') as {
        targetLabel?: string;
        summary?: string;
        uxPrioritizationRationale?: string;
        appliedRulesUsed?: string[];
        issues?: Array<Omit<AuditIssue, 'id' | 'status'>>;
      };

      const clamp = (n: number) =>
        Math.max(1, Math.min(100, Math.round(Number(n) || 50)));
      const validPriorities = new Set([
        'P0 Critical',
        'P1 High',
        'P2 Medium',
        'P3 Low',
      ]);
      const validCategories = new Set([
        'Error & Bug',
        'Accessibility',
        'Performance',
        'Usability & Flow',
        'Mobile UX',
        'SEO & Structure',
        'Custom Rule',
      ]);

      const normalizedIssues: AuditIssue[] = (parsed.issues || [])
        .map((item, idx) => ({
          id: `issue-${Date.now()}-${idx}`,
          title: item.title || `Issue ${idx + 1}`,
          priority: (validPriorities.has(item.priority)
            ? item.priority
            : 'P2 Medium') as AuditIssue['priority'],
          uxImpactScore: clamp(item.uxImpactScore),
          category: (validCategories.has(item.category)
            ? item.category
            : 'Usability & Flow') as AuditIssue['category'],
          affectedArea: item.affectedArea || 'Page Layout',
          userExperienceImpact: item.userExperienceImpact || '',
          evidence: item.evidence || '',
          solutionSummary: item.solutionSummary || '',
          beforeCode: item.beforeCode || '',
          afterCode: item.afterCode || '',
          matchedTaughtRule: item.matchedTaughtRule || '',
          impactDimensions: {
            taskCompletion: clamp(item.impactDimensions?.taskCompletion),
            accessibility: clamp(item.impactDimensions?.accessibility),
            perceivedSpeed: clamp(item.impactDimensions?.perceivedSpeed),
            trustAndClarity: clamp(item.impactDimensions?.trustAndClarity),
          },
          status: 'open' as const,
        }))
        .sort((a, b) => b.uxImpactScore - a.uxImpactScore);

      const audit: WebsiteAudit = {
        id: `audit-${Date.now()}`,
        targetLabel: parsed.targetLabel || targetLabel || 'Website Audit',
        inputType:
          inputType === 'code' || inputType === 'screenshot' ? inputType : 'url',
        url: effectiveUrl || undefined,
        analyzedAt: new Date().toISOString(),
        summary: parsed.summary || 'Analysis completed.',
        uxPrioritizationRationale:
          parsed.uxPrioritizationRationale ||
          'Issues ranked by impact on visitor task completion, clarity, accessibility, and speed.',
        appliedRulesUsed: Array.isArray(parsed.appliedRulesUsed)
          ? parsed.appliedRulesUsed
          : [],
        technicalSignals,
        issues: normalizedIssues,
      };

      saveAudit(audit);
      emitArixActivity({
        phase: 'done',
        node: 'text',
        title: 'Website Audit · Complete',
        detail: `Ranked ${audit.issues.length} UX issues for ${audit.targetLabel}`,
      });
      res.json(audit);
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitArixActivity({
        phase: 'error',
        node: 'text',
        title: 'Website Audit · Error',
        detail: formatted.message,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.patch('/api/audits/:auditId/issues/:issueId', (req, res) => {
    const status = req.body?.status === 'resolved' ? 'resolved' : 'open';
    const updated = updateIssueStatus(
      req.params.auditId,
      req.params.issueId,
      status
    );
    if (!updated) {
      res.status(404).json({ error: 'Audit or issue not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/audits/:auditId', (req, res) => {
    const ok = deleteAudit(req.params.auditId);
    if (!ok) {
      res.status(404).json({ error: 'Audit not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Arix Command Chat (Filesystem, Telegram, GitHub, Cloudflare, Websites & Memory tools)
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        message,
        auditId,
        issueId,
        connectionId,
        attachments,
        reasoningMode: rawReasoningMode,
      } = req.body ?? {};
      const cleanMessage = String(message || '').trim();
      const reasoningMode: ReasoningMode =
        rawReasoningMode === 'fast' || rawReasoningMode === 'deep'
          ? rawReasoningMode
          : 'balanced';

      const parsedBinaryAttachments: Array<{
        attachment: ChatAttachment;
        mimeType: string;
        base64: string;
      }> = [];
      const parsedTextAttachments: Array<{
        attachment: ChatAttachment;
        textContent: string;
      }> = [];

      if (Array.isArray(attachments)) {
        for (const item of attachments.slice(0, 4)) {
          if (!item || typeof item !== 'object') continue;
          const itemName =
            typeof item.name === 'string' && item.name
              ? item.name
              : `attachment-${parsedBinaryAttachments.length + parsedTextAttachments.length + 1}`;
          const itemId =
            typeof item.id === 'string' && item.id
              ? item.id
              : `att-${Date.now()}-${parsedBinaryAttachments.length + parsedTextAttachments.length}`;

          if (item.kind === 'text' || typeof item.textContent === 'string') {
            const textContent = String(item.textContent || '').slice(0, 35000);
            if (textContent) {
              parsedTextAttachments.push({
                attachment: {
                  id: itemId,
                  name: itemName,
                  mimeType:
                    typeof item.mimeType === 'string'
                      ? item.mimeType
                      : 'text/plain',
                  kind: 'text',
                  sizeBytes:
                    typeof item.sizeBytes === 'number'
                      ? item.sizeBytes
                      : Buffer.byteLength(textContent, 'utf-8'),
                },
                textContent,
              });
            }
            continue;
          }

          const rawDataUrl =
            typeof item.dataUrl === 'string' ? item.dataUrl : '';
          const rawBase64 = typeof item.base64 === 'string' ? item.base64 : '';
          let mimeType =
            typeof item.mimeType === 'string' &&
            (item.mimeType.startsWith('image/') ||
              item.mimeType === 'application/pdf')
              ? item.mimeType
              : 'image/png';
          let base64 = rawBase64;
          let dataUrl = rawDataUrl;

          if (!base64 && rawDataUrl.startsWith('data:')) {
            const commaIdx = rawDataUrl.indexOf(',');
            if (commaIdx > 0) {
              const header = rawDataUrl.slice(5, commaIdx);
              const semiIdx = header.indexOf(';');
              if (semiIdx > 0) {
                mimeType = header.slice(0, semiIdx);
              }
              base64 = rawDataUrl.slice(commaIdx + 1);
            }
          } else if (base64 && !dataUrl) {
            dataUrl = `data:${mimeType};base64,${base64}`;
          }

          if (
            base64 &&
            (mimeType.startsWith('image/') || mimeType === 'application/pdf')
          ) {
            const isPdf = mimeType === 'application/pdf';
            parsedBinaryAttachments.push({
              attachment: {
                id: itemId,
                name: itemName,
                mimeType,
                kind: isPdf ? 'pdf' : 'image',
                dataUrl: isPdf ? undefined : dataUrl,
                sizeBytes:
                  typeof item.sizeBytes === 'number' ? item.sizeBytes : undefined,
              },
              mimeType,
              base64,
            });
          }
        }
      }

      const totalAttachmentCount =
        parsedBinaryAttachments.length + parsedTextAttachments.length;

      if (!cleanMessage && totalAttachmentCount === 0) {
        res.status(400).json({
          error: 'Please enter a message or attach an image, PDF, or file.',
        });
        return;
      }

      const displayMessage =
        cleanMessage ||
        `Sent ${totalAttachmentCount} attachment${totalAttachmentCount > 1 ? 's' : ''}`;

      const state = getPublicState();
      const activeRules = state.rules.filter((r) => r.active);
      const ai = getGeminiClient();
      const rootDir = getActiveComputerRoot();

      const targetAudit = auditId
        ? state.audits.find((a) => a.id === auditId)
        : undefined;
      const targetIssue =
        targetAudit && issueId
          ? targetAudit.issues.find((i) => i.id === issueId)
          : undefined;
      const targetConnection = connectionId
        ? state.connections.find((c) => c.id === connectionId)
        : undefined;

      const contextParts: string[] = [];
      if (targetConnection) {
        contextParts.push(
          `FOCUSED CONNECTED PLATFORM:\nName: ${targetConnection.name}\nType: ${targetConnection.type}\nURL/Target: ${targetConnection.targetUrl}\nIdentifier: ${targetConnection.identifier}\nLast Sync: ${targetConnection.metadataSummary || 'Not synced yet'}`
        );
      }
      if (targetAudit) {
        contextParts.push(
          `ACTIVE WEBSITE AUDIT CONTEXT (${targetAudit.targetLabel}):\nSummary: ${targetAudit.summary}\nTop Issues:\n${targetAudit.issues
            .slice(0, 5)
            .map(
              (i) =>
                `- [${i.priority} | Score ${i.uxImpactScore}] ${i.title}: ${i.userExperienceImpact}`
            )
            .join('\n')}`
        );
      }
      if (targetIssue) {
        contextParts.push(
          `FOCUSED ISSUE:\nTitle: ${targetIssue.title}\nPriority: ${targetIssue.priority} (${targetIssue.uxImpactScore}/100)\nArea: ${targetIssue.affectedArea}\nEvidence: ${targetIssue.evidence}\nSolution: ${targetIssue.solutionSummary}`
        );
      }
      if (parsedTextAttachments.length > 0) {
        for (const tAtt of parsedTextAttachments) {
          contextParts.push(
            `ATTACHED FILE "${tAtt.attachment.name}" (${tAtt.attachment.mimeType}):\n\`\`\`\n${tAtt.textContent}\n\`\`\``
          );
        }
      }

      const recentHistory = state.chatHistory.slice(-6).map((m) => {
        const attachmentNote =
          m.attachments && m.attachments.length > 0
            ? ` [Attached ${m.attachments.length} file(s): ${m.attachments.map((a) => a.name).join(', ')}]`
            : '';
        const clipped =
          m.content.length > 1600
            ? `${m.content.slice(0, 1600)}\n...[truncated]`
            : m.content;
        return {
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          parts: [{ text: `${clipped}${attachmentNote}` }],
        };
      });

      const effectivePromptText =
        cleanMessage ||
        'Inspect the attached file(s)/image(s) in detail, explain what you see, and provide complete solutions or next steps.';

      const userTurnText =
        contextParts.length > 0
          ? `${contextParts.join('\n\n')}\n\nOWNER REQUEST:\n${effectivePromptText}`
          : effectivePromptText;

      const userTurnParts: Part[] = [
        ...parsedBinaryAttachments.map((a) => ({
          inlineData: {
            mimeType: a.mimeType,
            data: a.base64,
          },
        })),
        { text: userTurnText },
      ];

      const systemInstruction = `${buildArixSystemInstruction(
        state.persona,
        activeRules,
        state.connections,
        rootDir
      )}

AVAILABLE LIVE TOOLS:
- \`listComputerFolder\`: List files and folders inside any directory of the computer workspace (${rootDir}).
- \`createFileOrFolder\`: Create files or folders on the computer workspace.
- \`patchLocalFile\`: Surgically edit an existing file via exact search-and-replace without losing unrelated code.
- \`findLocalFiles\`: Search files and folders by name or content on the computer workspace.
- \`readLocalFile\`: Read a local file's content.
- \`deleteLocalPath\`: Delete a local file or folder.
- \`runComputerCommand\`: Execute shell commands (\`npm run build\`, \`tsc --noEmit\`, \`node ...\`, \`python ...\`, \`git status\`, tests) in ${rootDir} to verify and run code.
- \`googleSearch\`: Built-in Google Search grounding for real-time documentation, news, package versions, and web facts.
- \`sendToTelegram\`: Send messages directly to a connected Telegram bot/chat.
- \`saveTaughtRule\`: Permanently save any rule, coding pattern, or skill the owner teaches you.
- \`inspectConnectedSite\`: Fetch live HTML/headers/status from any URL.
- \`inspectGitHubRepo\`: Inspect a GitHub repository or read source files.
- \`writeGitHubFile\`: Create or update a file inside a connected GitHub repository (use connected GitHub repo automatically when the owner asks to add/commit to "my GitHub").
- \`inspectCloudflareDomain\`: Check Cloudflare DNS records, edge headers, and zone status.
- \`createSelfSection\`, \`updateSelfSection\`, \`deleteSelfSection\`: Add, update, or remove live interactive sections/tabs inside Arix itself! Whenever the owner teaches you coding or asks you to change yourself or create a section inside Arix, call \`createSelfSection\` with complete, dark-navy styled HTML/CSS/JS (#060E1F background, #0B152B cards, #38BDF8 accents, #f1f5f9 text) so the new section appears immediately in Arix's UI.
- \`createPresentation\`: Build complete multi-slide PowerPoint (.pptx) presentations saved to \`presentations/<file>.pptx\` AND automatically launch an interactive slide deck viewer inside Arix (with keyboard arrow navigation, fullscreen mode, speaker notes, and Download .pptx). Follow any taught presentation rules strictly!
- \`inspectArixSourceFile\`, \`editArixSourceFile\`: Read and modify Arix's own project source files (src/, server/, public/, electron/) with automatic backup.

EXISTING SELF-BUILT SECTIONS INSIDE ARIX:
${
  state.customSections.length > 0
    ? state.customSections
        .map((s) => `- [${s.id}] "${s.title}" (nav: "${s.navLabel}", placement: ${s.placement})`)
        .join('\n')
    : 'None yet.'
}`;

      const needsWebSearch =
        /\b(search|google|latest|news|today|current|price|version|release|docs|documentation|who is|what happened|2025|2026)\b/i.test(
          cleanMessage
        );

      const functionDeclarations = [
        listComputerFolderDeclaration,
        createFileOrFolderDeclaration,
        patchLocalFileDeclaration,
        findLocalFilesDeclaration,
        readLocalFileDeclaration,
        deleteLocalPathDeclaration,
        runComputerCommandDeclaration,
        sendToTelegramDeclaration,
        saveTaughtRuleDeclaration,
        createSelfSectionDeclaration,
        updateSelfSectionDeclaration,
        deleteSelfSectionDeclaration,
        createPresentationDeclaration,
        inspectArixSourceFileDeclaration,
        editArixSourceFileDeclaration,
        inspectConnectedSiteDeclaration,
        inspectGitHubRepoDeclaration,
        writeGitHubFileDeclaration,
        inspectCloudflareDomainDeclaration,
      ];

      const tools = needsWebSearch
        ? [{ googleSearch: {} }, { functionDeclarations }]
        : [{ functionDeclarations }];
      const toolConfig = needsWebSearch
        ? { includeServerSideToolInvocations: true }
        : undefined;

      let conversationContents: Array<{ role: 'user' | 'model'; parts: Part[] }> = [
        ...recentHistory,
        { role: 'user', parts: userTurnParts },
      ];

      const newlyLearnedRules: TaughtRule[] = [];
      const toolsInvoked: string[] = [];
      const collectedThoughts: string[] = [];
      const collectedSourcesMap = new Map<string, ChatSource>();
      let finalReply = '';
      let lastActiveNode: ArixSatelliteKey = 'core';

      const primaryThinkingConfig =
        reasoningMode === 'fast'
          ? { thinkingLevel: ThinkingLevel.LOW }
          : reasoningMode === 'deep'
            ? { thinkingLevel: ThinkingLevel.HIGH, includeThoughts: true }
            : { thinkingLevel: ThinkingLevel.MEDIUM };

      const followUpThinkingConfig =
        reasoningMode === 'deep'
          ? { thinkingLevel: ThinkingLevel.HIGH, includeThoughts: true }
          : { thinkingLevel: ThinkingLevel.LOW };

      emitArixActivity({
        phase: 'thinking',
        node: 'core',
        title:
          reasoningMode === 'fast'
            ? 'Arix Core · Fast Reply'
            : reasoningMode === 'deep'
              ? 'Arix Core · Deep Reasoning'
              : 'Arix Core · Thinking',
        detail: displayMessage.slice(0, 90),
      });

      for (let step = 0; step < 8; step++) {
        const response = await generateContentWithRetry(
          ai,
          {
            model: ARIX_MODEL,
            contents: conversationContents,
            config: {
              systemInstruction,
              tools,
              toolConfig,
              thinkingConfig:
                step === 0 ? primaryThinkingConfig : followUpThinkingConfig,
            },
          },
          {
            onRetry: (reason) => {
              emitArixActivity({
                phase: 'thinking',
                node: 'core',
                title: 'Arix Core · Auto-Retrying',
                detail: reason,
              });
            },
          }
        );

        const groundingChunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(groundingChunks)) {
          for (const chunk of groundingChunks) {
            const web = (
              chunk as { web?: { uri?: string; title?: string } }
            ).web;
            if (web?.uri && !collectedSourcesMap.has(web.uri)) {
              collectedSourcesMap.set(web.uri, {
                title: web.title || web.uri,
                url: web.uri,
              });
            }
          }
        }

        const extracted = extractAnswerAndThoughts(response);
        if (extracted.thoughts) {
          collectedThoughts.push(extracted.thoughts);
          emitArixActivity({
            phase: 'thinking',
            node: 'core',
            title: 'Arix Core · Analyzing',
            detail: extracted.thoughts.split('\n')[0].slice(0, 110),
          });
        }

        const previousContent = response.candidates?.[0]?.content;
        const fnCalls = response.functionCalls;

        if (!fnCalls || fnCalls.length === 0) {
          finalReply = extracted.text || response.text || finalReply;
          break;
        }

        if (!previousContent) break;

        const validCategories: RuleCategory[] = [
          'coding',
          'analysis_ux',
          'connections',
          'automation',
          'owner_directive',
        ];
        const validWeights: RuleWeight[] = ['strict', 'preferred', 'advisory'];

        const responseParts: Part[] = [];

        for (const call of fnCalls) {
          const args = (call.args || {}) as Record<string, unknown>;
          const toolName = call.name || 'tool';
          toolsInvoked.push(toolName);
          const toolNode = mapToolToNode(toolName);
          lastActiveNode = toolNode;
          const startMeta = formatToolStartDetail(toolName, args);
          emitArixActivity({
            phase: 'tool_start',
            node: toolNode,
            toolName,
            title: startMeta.title,
            detail: startMeta.detail,
          });

          try {
            if (toolName === 'listComputerFolder') {
              const listed = listComputerEntries(
                rootDir,
                String(args.subDir || '')
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, computerRoot: rootDir, ...listed },
                },
              });
            } else if (toolName === 'createFileOrFolder') {
              const out = createFileOrFolder(rootDir, {
                targetPath: String(args.targetPath || ''),
                kind: args.kind === 'folder' ? 'folder' : 'file',
                content:
                  args.content !== undefined ? String(args.content) : undefined,
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, ...out, computerRoot: rootDir },
                },
              });
            } else if (toolName === 'patchLocalFile') {
              const patched = patchLocalFile(rootDir, {
                targetPath: String(args.targetPath || ''),
                findText: String(args.findText ?? ''),
                replaceText: String(args.replaceText ?? ''),
                replaceAll: Boolean(args.replaceAll),
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, ...patched, computerRoot: rootDir },
                },
              });
            } else if (toolName === 'findLocalFiles') {
              const matches = findLocalFiles(
                rootDir,
                String(args.query || '')
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, computerRoot: rootDir, matches },
                },
              });
            } else if (toolName === 'readLocalFile') {
              const file = readLocalFile(
                rootDir,
                String(args.targetPath || '')
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, ...file },
                },
              });
            } else if (toolName === 'deleteLocalPath') {
              const del = deleteLocalPath(
                rootDir,
                String(args.targetPath || '')
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: true, ...del },
                },
              });
            } else if (toolName === 'runComputerCommand') {
              const cmdRes = await runComputerCommand(
                rootDir,
                String(args.command || ''),
                args.subDir ? String(args.subDir) : ''
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: cmdRes,
                },
              });
            } else if (toolName === 'sendToTelegram') {
              const reqConnId = args.connectionId
                ? String(args.connectionId)
                : '';
              const tgConn = reqConnId
                ? state.connections.find(
                    (c) => c.id === reqConnId && c.type === 'telegram'
                  )
                : state.connections.find(
                    (c) => c.type === 'telegram' && c.active
                  );

              if (!tgConn) {
                const tgErr =
                  'No active Telegram bot connected. Please connect your Telegram bot in Connect Sites first.';
                emitArixActivity({
                  phase: 'error',
                  node: 'network',
                  toolName,
                  title: 'Telegram · Not connected',
                  detail: tgErr,
                });
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: toolName,
                    response: { ok: false, error: tgErr },
                  },
                });
              } else {
                const token = getConnectionToken(tgConn.id);
                const chatId = String(
                  args.chatId || tgConn.identifier || ''
                ).trim();
                if (!token || !chatId) {
                  const tgErr =
                    'Missing Telegram Bot Token or Chat ID. Send /start to your bot and click Sync in Connect Sites.';
                  emitArixActivity({
                    phase: 'error',
                    node: 'network',
                    toolName,
                    title: 'Telegram · Needs sync',
                    detail: tgErr,
                  });
                  responseParts.push({
                    functionResponse: {
                      id: call.id,
                      name: toolName,
                      response: { ok: false, error: tgErr },
                    },
                  });
                } else {
                  const sent = await sendTelegramMessage(
                    token,
                    chatId,
                    String(args.message || '')
                  );
                  emitArixActivity({
                    phase: sent.ok ? 'tool_done' : 'error',
                    node: 'network',
                    toolName,
                    title: sent.ok ? 'Telegram · Sent' : 'Telegram · Failed',
                    detail: sent.ok
                      ? `Delivered message via ${tgConn.name}`
                      : sent.error || 'Telegram send failed.',
                  });
                  responseParts.push({
                    functionResponse: {
                      id: call.id,
                      name: toolName,
                      response: sent,
                    },
                  });
                }
              }
            } else if (toolName === 'saveTaughtRule') {
              const saved = addRule({
                title: String(args.title || 'Owner Instruction').trim(),
                instruction: String(args.instruction || cleanMessage).trim(),
                category: validCategories.includes(
                  args.category as RuleCategory
                )
                  ? (args.category as RuleCategory)
                  : 'owner_directive',
                weight: validWeights.includes(args.weight as RuleWeight)
                  ? (args.weight as RuleWeight)
                  : 'strict',
                active: true,
                source: 'chat',
              });
              newlyLearnedRules.push(saved);
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: {
                    saved: true,
                    ruleId: saved.id,
                    title: saved.title,
                  },
                },
              });
            } else if (toolName === 'createSelfSection') {
              const placementRaw = String(args.placement || 'sidebar_tab');
              const placement =
                placementRaw === 'main_page' || placementRaw === 'both'
                  ? placementRaw
                  : 'sidebar_tab';
              const created = addCustomSection({
                title: String(args.title || 'Custom Section').trim(),
                navLabel: String(args.navLabel || args.title || 'Custom')
                  .trim()
                  .slice(0, 24),
                description: String(args.description || '').trim(),
                placement,
                htmlCode: String(args.htmlCode || '<div>Ready</div>'),
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: {
                    ok: true,
                    sectionId: created.id,
                    title: created.title,
                    navLabel: created.navLabel,
                    placement: created.placement,
                  },
                },
              });
            } else if (toolName === 'updateSelfSection') {
              const idOrTitle = String(args.idOrTitle || '').trim();
              const patch: Record<string, unknown> = {};
              if (args.title !== undefined) patch.title = String(args.title);
              if (args.navLabel !== undefined)
                patch.navLabel = String(args.navLabel).slice(0, 24);
              if (args.description !== undefined)
                patch.description = String(args.description);
              if (
                args.placement === 'sidebar_tab' ||
                args.placement === 'main_page' ||
                args.placement === 'both'
              ) {
                patch.placement = args.placement;
              }
              if (args.htmlCode !== undefined)
                patch.htmlCode = String(args.htmlCode);

              const updated = updateCustomSection(idOrTitle, patch);
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: updated
                    ? { ok: true, sectionId: updated.id, title: updated.title }
                    : { ok: false, error: `Section "${idOrTitle}" not found.` },
                },
              });
            } else if (toolName === 'deleteSelfSection') {
              const idOrTitle = String(args.idOrTitle || '').trim();
              const deleted = deleteCustomSection(idOrTitle);
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { ok: deleted, idOrTitle },
                },
              });
            } else if (toolName === 'createPresentation') {
              const title = String(args.title || 'Arix Presentation').trim();
              const subtitle = args.subtitle
                ? String(args.subtitle).trim()
                : undefined;
              const rawTheme = String(args.theme || 'midnight_blue');
              const theme: PresentationThemeKey =
                rawTheme === 'clean_light' ||
                rawTheme === 'executive_slate' ||
                rawTheme === 'emerald_tech'
                  ? rawTheme
                  : 'midnight_blue';
              const slides = Array.isArray(args.slides)
                ? (args.slides as PresentationSlideInput[])
                : [];
              const presResult = await buildPresentationDeck({
                title,
                subtitle,
                author: state.persona.ownerName || 'Owner',
                theme,
                fileName: args.fileName ? String(args.fileName) : undefined,
                computerRoot: rootDir,
                slides,
              });

              let sectionId: string | undefined;
              if (args.saveInteractiveSection !== false) {
                const rawPlacement = String(args.placement || 'both');
                const placement =
                  rawPlacement === 'sidebar_tab' ||
                  rawPlacement === 'main_page'
                    ? rawPlacement
                    : 'both';
                const section = addCustomSection({
                  title: `Deck: ${presResult.title}`,
                  navLabel: presResult.title.slice(0, 20),
                  description: `${presResult.slideCount} slides · ${presResult.relativePath}`,
                  placement,
                  htmlCode: presResult.interactiveHtml,
                });
                sectionId = section.id;
              }

              emitArixActivity({
                phase: 'tool_done',
                node: 'text',
                toolName,
                title: `Presentation · ${presResult.slideCount} slides ready`,
                detail: `${presResult.relativePath} created`,
              });

              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: {
                    ok: true,
                    title: presResult.title,
                    theme: presResult.theme,
                    slideCount: presResult.slideCount,
                    fileName: presResult.fileName,
                    relativePath: presResult.relativePath,
                    downloadUrl: presResult.downloadUrl,
                    sectionId,
                  },
                },
              });
            } else if (toolName === 'inspectArixSourceFile') {
              const inspected = inspectArixSourceFile(
                String(args.filePath || '.')
              );
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: inspected,
                },
              });
            } else if (toolName === 'editArixSourceFile') {
              const edited = editArixSourceFile({
                filePath: String(args.filePath || ''),
                content: String(args.content ?? ''),
                reason: args.reason ? String(args.reason) : undefined,
              });
              emitArixActivity({
                phase: edited.ok ? 'tool_done' : 'error',
                node: 'code',
                toolName,
                title: edited.ok ? 'Self-Code · Updated' : 'Self-Code · Blocked',
                detail: edited.summary.slice(0, 130),
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: edited,
                },
              });
            } else if (toolName === 'inspectConnectedSite') {
              const targetUrl = String(args.url || '');
              const scraped = await scrapeWebsite(targetUrl);
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: {
                    signals: scraped.signals,
                    textExcerpt: scraped.textExcerpt.slice(0, 3500),
                    htmlExcerpt: scraped.htmlExcerpt.slice(0, 4000),
                  },
                },
              });
            } else if (toolName === 'inspectGitHubRepo') {
              const rawRepoInput = String(args.repo || '').trim();
              const filePath = args.filePath
                ? String(args.filePath)
                : undefined;
              const defaultGhConn =
                (targetConnection?.type === 'github'
                  ? targetConnection
                  : undefined) ||
                state.connections.find(
                  (c) => c.type === 'github' && c.active
                );
              const parsed =
                parseGitHubOwnerRepo(rawRepoInput) ||
                (defaultGhConn
                  ? parseGitHubOwnerRepo(
                      defaultGhConn.identifier || defaultGhConn.targetUrl
                    )
                  : null);
              if (!parsed) {
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: toolName,
                    response: {
                      error:
                        'No connected GitHub repo found or invalid owner/repo format.',
                    },
                  },
                });
              } else {
                const matchingConn = state.connections.find(
                  (c) =>
                    c.type === 'github' &&
                    c.identifier.toLowerCase() ===
                      `${parsed.owner}/${parsed.repo}`.toLowerCase()
                );
                const firstGhTokenConn = state.connections.find(
                  (c) => c.type === 'github' && c.hasToken
                );
                const token = matchingConn
                  ? getConnectionToken(matchingConn.id)
                  : firstGhTokenConn
                    ? getConnectionToken(firstGhTokenConn.id)
                    : undefined;
                const gh = await inspectGitHubRepository(
                  parsed.owner,
                  parsed.repo,
                  token,
                  filePath
                );
                emitArixActivity({
                  phase: gh.ok ? 'tool_done' : 'error',
                  node: 'code',
                  toolName,
                  title: gh.ok ? 'GitHub · Inspected' : 'GitHub · Warning',
                  detail: gh.summary.slice(0, 120),
                });
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: toolName,
                    response: gh,
                  },
                });
              }
            } else if (toolName === 'writeGitHubFile') {
              const rawRepoInput = String(args.repo || '').trim();
              const defaultGhConn =
                (targetConnection?.type === 'github'
                  ? targetConnection
                  : undefined) ||
                state.connections.find(
                  (c) => c.type === 'github' && c.active
                );
              const parsed = rawRepoInput
                ? parseGitHubOwnerRepo(rawRepoInput)
                : defaultGhConn
                  ? parseGitHubOwnerRepo(
                      defaultGhConn.identifier || defaultGhConn.targetUrl
                    )
                  : null;

              if (!parsed) {
                const errSummary =
                  'No connected GitHub repository found. Please connect a GitHub repository (with a write token) in Connect Sites first.';
                emitArixActivity({
                  phase: 'error',
                  node: 'code',
                  toolName,
                  title: 'GitHub · Repo needed',
                  detail: errSummary,
                });
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: toolName,
                    response: { ok: false, error: errSummary },
                  },
                });
              } else {
                const matchingConn = state.connections.find(
                  (c) =>
                    c.type === 'github' &&
                    c.identifier.toLowerCase() ===
                      `${parsed.owner}/${parsed.repo}`.toLowerCase()
                );
                const firstGhTokenConn = state.connections.find(
                  (c) => c.type === 'github' && c.hasToken
                );
                const token = matchingConn
                  ? getConnectionToken(matchingConn.id)
                  : firstGhTokenConn
                    ? getConnectionToken(firstGhTokenConn.id)
                    : undefined;
                const writeRes = await writeGitHubFile({
                  owner: parsed.owner,
                  repo: parsed.repo,
                  filePath: String(args.filePath || ''),
                  content: String(args.content ?? ''),
                  commitMessage: args.commitMessage
                    ? String(args.commitMessage)
                    : undefined,
                  branch: args.branch ? String(args.branch) : undefined,
                  token,
                });
                emitArixActivity({
                  phase: writeRes.ok ? 'tool_done' : 'error',
                  node: 'code',
                  toolName,
                  title: writeRes.ok
                    ? 'GitHub · File committed'
                    : 'GitHub · Write blocked',
                  detail: writeRes.summary.slice(0, 140),
                });
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: toolName,
                    response: writeRes,
                  },
                });
              }
            } else if (toolName === 'inspectCloudflareDomain') {
              const domainInput = String(args.domainOrUrl || '');
              const matchingCf = state.connections.find(
                (c) =>
                  c.type === 'cloudflare' &&
                  (c.targetUrl.includes(domainInput) ||
                    domainInput.includes(c.targetUrl) ||
                    c.name.toLowerCase().includes(domainInput.toLowerCase()))
              );
              const token = matchingCf
                ? getConnectionToken(matchingCf.id)
                : undefined;
              const cf = await inspectCloudflareConnection(
                domainInput,
                matchingCf && !matchingCf.identifier.includes('.')
                  ? matchingCf.identifier
                  : undefined,
                token
              );
              emitArixActivity({
                phase: 'tool_done',
                node: 'compute',
                toolName,
                title: 'Cloudflare · Synced',
                detail: cf.summary.slice(0, 120),
              });
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: cf,
                },
              });
            } else {
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: toolName,
                  response: { error: 'Unknown tool' },
                },
              });
            }

            if (
              toolName !== 'inspectGitHubRepo' &&
              toolName !== 'writeGitHubFile' &&
              toolName !== 'inspectCloudflareDomain' &&
              toolName !== 'sendToTelegram' &&
              toolName !== 'editArixSourceFile' &&
              toolName !== 'createPresentation'
            ) {
              emitArixActivity({
                phase: 'tool_done',
                node: toolNode,
                toolName,
                title: formatToolDoneTitle(toolName),
                detail: startMeta.detail.replace(/\.\.\.$/, ''),
              });
            }
          } catch (toolErr) {
            emitArixActivity({
              phase: 'error',
              node: toolNode,
              toolName,
              title: `${toolName} · Error`,
              detail:
                toolErr instanceof Error
                  ? toolErr.message
                  : 'Tool execution error',
            });
            responseParts.push({
              functionResponse: {
                id: call.id,
                name: toolName,
                response: {
                  ok: false,
                  error:
                    toolErr instanceof Error
                      ? toolErr.message
                      : 'Tool execution error',
                },
              },
            });
          }
        }

        conversationContents = [
          ...conversationContents,
          { role: 'model', parts: previousContent.parts || [] },
          { role: 'user', parts: responseParts },
        ];
      }

      if (!finalReply && toolsInvoked.length > 0) {
        try {
          const synthesisResp = await generateContentWithRetry(ai, {
            model: ARIX_MODEL,
            contents: [
              ...conversationContents,
              {
                role: 'user',
                parts: [
                  {
                    text: 'Provide a clear, thorough final analysis and answer to the owner summarizing what was done, exact results/paths/links, and next steps.',
                  },
                ],
              },
            ],
            config: {
              systemInstruction,
              thinkingConfig: followUpThinkingConfig,
            },
          });
          const synthExtracted = extractAnswerAndThoughts(synthesisResp);
          if (synthExtracted.thoughts) {
            collectedThoughts.push(synthExtracted.thoughts);
          }
          finalReply = synthExtracted.text || synthesisResp.text || '';
        } catch {
          // Fall back to deterministic summary below if synthesis fails
        }
      }

      if (!finalReply) {
        finalReply =
          newlyLearnedRules.length > 0
            ? `Understood — I learned "${newlyLearnedRules[0].title}" and saved it permanently.`
            : 'Task completed. Let me know what you want me to build, inspect, or run next.';
      }

      const thinkingSummary =
        collectedThoughts.length > 0
          ? collectedThoughts.join('\n\n').trim()
          : undefined;

      const savedAttachments: ChatAttachment[] = [
        ...parsedBinaryAttachments.map((a) => a.attachment),
        ...parsedTextAttachments.map((a) => a.attachment),
      ];

      const collectedSources = Array.from(collectedSourcesMap.values()).slice(
        0,
        8
      );

      const appliedRulesUsed = activeRules.map((r) => r.title);
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        role: 'user',
        content: displayMessage,
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        timestamp: new Date().toISOString(),
        auditId: targetAudit?.id,
        issueId: targetIssue?.id,
        issueTitle: targetIssue?.title,
      };
      const arixMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'arix',
        content: finalReply,
        sources: collectedSources.length > 0 ? collectedSources : undefined,
        thinkingSummary,
        reasoningMode,
        timestamp: new Date().toISOString(),
        auditId: targetAudit?.id,
        issueId: targetIssue?.id,
        issueTitle: targetIssue?.title,
        newlyLearnedRules:
          newlyLearnedRules.length > 0 ? newlyLearnedRules : undefined,
        appliedRulesUsed,
        toolsInvoked:
          toolsInvoked.length > 0 ? [...new Set(toolsInvoked)] : undefined,
      };

      appendChatMessages([userMsg, arixMsg]);
      emitArixActivity({
        phase: 'done',
        node: lastActiveNode,
        title:
          toolsInvoked.length > 0
            ? `Completed (${[...new Set(toolsInvoked)].join(', ')})`
            : 'Arix Core · Ready',
        detail: finalReply.split('\n')[0].slice(0, 120),
      });
      res.json({
        userMessage: userMsg,
        arixMessage: arixMsg,
        newlyLearnedRules,
        customSections: getCustomSections(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitArixActivity({
        phase: 'error',
        node: 'core',
        title: 'Arix · Error',
        detail: formatted.message,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.delete('/api/chat', (_req, res) => {
    clearChatHistory();
    res.json({ cleared: true });
  });

  // Gemini TTS Speech Generation (gemini-3.8-flash-lite-tts)
  app.post('/api/voice/speak', async (req, res) => {
    try {
      const { text, voiceName: rawVoice, style } = req.body ?? {};
      const validVoices = new Set([
        'Kore',
        'Puck',
        'Charon',
        'Fenrir',
        'Zephyr',
      ]);
      const voiceName = validVoices.has(String(rawVoice))
        ? String(rawVoice)
        : 'Kore';

      const spokenText = String(text || '')
        .replace(/```[\s\S]*?```/g, ' I have included the code in the chat. ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);

      if (!spokenText) {
        res.status(400).json({ error: 'No speakable text provided.' });
        return;
      }

      const ai = getGeminiClient();
      emitArixActivity({
        phase: 'tool_start',
        node: 'text',
        toolName: 'voiceSpeak',
        title: `Voice · ${voiceName}`,
        detail: `Generating speech (${spokenText.slice(0, 60)}...)`,
      });

      const ttsResponse = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: spokenText,
                  speechMetadata: {
                    style:
                      typeof style === 'string' && style.trim()
                        ? style.trim()
                        : 'Clear, natural, expressive personal AI assistant',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        },
        { allowFallback: false }
      );

      const parts = ttsResponse.candidates?.[0]?.content?.parts || [];
      let audioBase64 = '';
      for (const p of parts) {
        if (p.inlineData?.data) {
          audioBase64 = p.inlineData.data;
          break;
        }
      }

      if (!audioBase64) {
        throw new Error('Gemini TTS did not return audio data.');
      }

      emitArixActivity({
        phase: 'done',
        node: 'text',
        title: `Voice · ${voiceName} ready`,
        detail: 'Speech audio generated',
      });

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
        voiceName,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitArixActivity({
        phase: 'error',
        node: 'text',
        title: 'Voice · Error',
        detail: formatted.message,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Gemini Audio Transcription for Voice Commands (gemini-3.5-transcribe)
  app.post('/api/voice/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body ?? {};
      const cleanBase64 = String(audioBase64 || '')
        .replace(/^data:[^;]+;base64,/, '')
        .trim();

      if (!cleanBase64) {
        res.status(400).json({ error: 'No audio data provided.' });
        return;
      }

      const rawMime = String(mimeType || 'audio/webm')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const allowedMimes = new Set([
        'audio/webm',
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/aac',
        'audio/flac',
      ]);
      const safeMime = allowedMimes.has(rawMime) ? rawMime : 'audio/webm';

      const ai = getGeminiClient();
      emitArixActivity({
        phase: 'tool_start',
        node: 'text',
        toolName: 'voiceTranscribe',
        title: 'Voice · Listening',
        detail: 'Transcribing your voice command...',
      });

      const transcribeRes = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            {
              text: 'Transcribe the user spoken voice command accurately into clean plain text without adding commentary, timestamps, or quotation marks. If no speech is audible, return an empty string.',
            },
          ],
        },
      });

      const transcript = (transcribeRes.text || '').trim();
      emitArixActivity({
        phase: 'done',
        node: 'text',
        title: 'Voice · Transcribed',
        detail: transcript
          ? transcript.slice(0, 75)
          : 'No speech detected in audio',
      });

      res.json({ transcript });
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitArixActivity({
        phase: 'error',
        node: 'text',
        title: 'Voice · Transcription Error',
        detail: formatted.message,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    if (process.env.DISABLE_HMR === 'true') {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    invalidate: noop,
    decline: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(process.env.DISABLE_HMR === 'true'
          ? { hmr: false, ws: false }
          : { ws: { server: httpServer } }),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Arix AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
