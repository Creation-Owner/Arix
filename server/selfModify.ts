import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const ALLOWED_ROOT_DIRS = new Set(['src', 'server', 'public', 'electron']);
const BLOCKED_EXACT = new Set([
  '.env',
  '.env.local',
  'metadata.json',
  'package-lock.json',
]);

function resolveProjectSourcePath(relPath: string): {
  absolute: string;
  relative: string;
} {
  const clean = String(relPath || '')
    .trim()
    .replace(/^[/\\]+/, '');
  if (!clean || clean.includes('..')) {
    throw new Error('Invalid relative source file path.');
  }

  const normalized = path.posix.normalize(clean.replace(/\\/g, '/'));
  if (
    normalized.startsWith('.git') ||
    normalized.startsWith('node_modules') ||
    normalized.startsWith('data') ||
    normalized.startsWith('dist') ||
    BLOCKED_EXACT.has(normalized)
  ) {
    throw new Error(`Protected path cannot be modified: ${normalized}`);
  }

  const topSegment = normalized.split('/')[0];
  if (!ALLOWED_ROOT_DIRS.has(topSegment)) {
    throw new Error(
      `Self-source editing is scoped to project directories (${Array.from(
        ALLOWED_ROOT_DIRS
      ).join(', ')}). Requested: ${normalized}`
    );
  }

  const absolute = path.resolve(PROJECT_ROOT, normalized);
  if (!absolute.startsWith(PROJECT_ROOT + path.sep)) {
    throw new Error('Path traversal is blocked.');
  }

  return { absolute, relative: normalized };
}

export function listArixSourceFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        results.push(path.relative(PROJECT_ROOT, abs).replace(/\\/g, '/'));
      }
    }
  }
  for (const dir of ALLOWED_ROOT_DIRS) {
    walk(path.join(PROJECT_ROOT, dir));
  }
  return results.sort();
}

export function inspectArixSourceFile(relPath: string): {
  ok: boolean;
  path: string;
  content?: string;
  availableFiles?: string[];
  error?: string;
} {
  try {
    if (!relPath || relPath === '.' || relPath === '*') {
      return {
        ok: true,
        path: '.',
        availableFiles: listArixSourceFiles(),
      };
    }
    const { absolute, relative } = resolveProjectSourcePath(relPath);
    if (!fs.existsSync(absolute)) {
      return {
        ok: false,
        path: relative,
        error: `Source file not found: ${relative}`,
        availableFiles: listArixSourceFiles(),
      };
    }
    const content = fs.readFileSync(absolute, 'utf-8');
    return {
      ok: true,
      path: relative,
      content: content.slice(0, 28000),
    };
  } catch (err) {
    return {
      ok: false,
      path: relPath,
      error: err instanceof Error ? err.message : 'Unable to read source file.',
    };
  }
}

export function editArixSourceFile(params: {
  filePath: string;
  content: string;
  reason?: string;
}): {
  ok: boolean;
  path: string;
  backupPath?: string;
  bytesWritten?: number;
  summary: string;
} {
  try {
    const { absolute, relative } = resolveProjectSourcePath(params.filePath);
    let backupPath: string | undefined;

    if (fs.existsSync(absolute)) {
      const backupDir = path.join(PROJECT_ROOT, 'data', 'self-backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const safeName = relative.replace(/[/\\]/g, '__');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupAbs = path.join(backupDir, `${stamp}__${safeName}`);
      fs.copyFileSync(absolute, backupAbs);
      backupPath = path.relative(PROJECT_ROOT, backupAbs).replace(/\\/g, '/');
    } else {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
    }

    fs.writeFileSync(absolute, params.content, 'utf-8');
    return {
      ok: true,
      path: relative,
      backupPath,
      bytesWritten: Buffer.byteLength(params.content, 'utf-8'),
      summary: `Updated ${relative}${backupPath ? ` (backup saved at ${backupPath})` : ''}.`,
    };
  } catch (err) {
    return {
      ok: false,
      path: params.filePath,
      summary:
        err instanceof Error ? err.message : 'Unable to modify source file.',
    };
  }
}
