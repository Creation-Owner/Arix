import fs from 'fs';
import path from 'path';
import type { ComputerEntry } from '../src/types/arix.ts';

const DEFAULT_WORKSPACE = path.resolve(process.cwd(), 'arix-workspace');

export function resolveComputerRoot(overrideRoot?: string): string {
  const candidate =
    (overrideRoot && overrideRoot.trim()) ||
    (process.env.ARIX_COMPUTER_ROOT && process.env.ARIX_COMPUTER_ROOT.trim()) ||
    '';

  if (candidate) {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }

  if (!fs.existsSync(DEFAULT_WORKSPACE)) {
    fs.mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
  }
  return DEFAULT_WORKSPACE;
}

export function resolveSafeSubpath(
  rootDir: string,
  relativeTarget: string
): { absolute: string; relative: string } {
  const cleanRel = String(relativeTarget || '')
    .trim()
    .replace(/^[/\\]+/, '');

  const absolute = path.resolve(rootDir, cleanRel);
  const normalizedRoot = path.resolve(rootDir);

  if (
    absolute !== normalizedRoot &&
    !absolute.startsWith(normalizedRoot + path.sep)
  ) {
    throw new Error(
      `Access outside configured computer root (${normalizedRoot}) is blocked.`
    );
  }

  const relative = path.relative(normalizedRoot, absolute) || '.';
  return { absolute, relative };
}

export function listComputerEntries(
  rootDir: string,
  subDir = ''
): { currentPath: string; entries: ComputerEntry[] } {
  const { absolute, relative } = resolveSafeSubpath(rootDir, subDir);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Directory not found: ${relative}`);
  }
  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${relative}`);
  }

  const dirents = fs.readdirSync(absolute, { withFileTypes: true });
  const entries: ComputerEntry[] = [];

  for (const d of dirents) {
    if (d.name === '.git' || d.name === 'node_modules') continue;
    const itemAbs = path.join(absolute, d.name);
    const itemStat = fs.statSync(itemAbs);
    entries.push({
      name: d.name,
      relativePath: path.relative(rootDir, itemAbs),
      type: d.isDirectory() ? 'directory' : 'file',
      sizeBytes: d.isDirectory() ? 0 : itemStat.size,
      modifiedAt: itemStat.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { currentPath: relative, entries };
}

export function createFileOrFolder(
  rootDir: string,
  params: {
    targetPath: string;
    kind: 'file' | 'folder';
    content?: string;
  }
): { createdPath: string; kind: 'file' | 'folder'; sizeBytes: number } {
  const cleanTarget = String(params.targetPath || '').trim();
  if (!cleanTarget || cleanTarget === '.' || cleanTarget === '/') {
    throw new Error('Please specify a file or folder name/path.');
  }

  const { absolute, relative } = resolveSafeSubpath(rootDir, cleanTarget);

  if (params.kind === 'folder') {
    fs.mkdirSync(absolute, { recursive: true });
    return { createdPath: relative, kind: 'folder', sizeBytes: 0 };
  }

  const parent = path.dirname(absolute);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  const body = params.content !== undefined ? String(params.content) : '';
  fs.writeFileSync(absolute, body, 'utf-8');
  return {
    createdPath: relative,
    kind: 'file',
    sizeBytes: Buffer.byteLength(body, 'utf-8'),
  };
}

export function readLocalFile(
  rootDir: string,
  targetPath: string
): { path: string; content: string; sizeBytes: number } {
  const { absolute, relative } = resolveSafeSubpath(rootDir, targetPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${relative}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    throw new Error(`"${relative}" is a folder, not a file.`);
  }
  const content = fs.readFileSync(absolute, 'utf-8');
  return {
    path: relative,
    content: content.slice(0, 24000),
    sizeBytes: stat.size,
  };
}

export function findLocalFiles(
  rootDir: string,
  query: string,
  maxResults = 30
): Array<{
  relativePath: string;
  type: 'file' | 'directory';
  matchReason: 'name' | 'content';
  sizeBytes: number;
}> {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    throw new Error('Search query cannot be empty.');
  }

  const matches: Array<{
    relativePath: string;
    type: 'file' | 'directory';
    matchReason: 'name' | 'content';
    sizeBytes: number;
  }> = [];

  function walk(dir: string, depth: number) {
    if (depth > 8 || matches.length >= maxResults) return;
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const d of dirents) {
      if (matches.length >= maxResults) break;
      if (d.name === 'node_modules' || d.name === '.git') continue;

      const abs = path.join(dir, d.name);
      const rel = path.relative(rootDir, abs);
      const isDir = d.isDirectory();

      if (d.name.toLowerCase().includes(q) || rel.toLowerCase().includes(q)) {
        let size = 0;
        if (!isDir) {
          try {
            size = fs.statSync(abs).size;
          } catch {
            size = 0;
          }
        }
        matches.push({
          relativePath: rel,
          type: isDir ? 'directory' : 'file',
          matchReason: 'name',
          sizeBytes: size,
        });
      } else if (!isDir) {
        try {
          const stat = fs.statSync(abs);
          if (stat.size > 0 && stat.size <= 256 * 1024) {
            const text = fs.readFileSync(abs, 'utf-8');
            if (text.toLowerCase().includes(q)) {
              matches.push({
                relativePath: rel,
                type: 'file',
                matchReason: 'content',
                sizeBytes: stat.size,
              });
            }
          }
        } catch {
          // Skip binary/unreadable files
        }
      }

      if (isDir) {
        walk(abs, depth + 1);
      }
    }
  }

  walk(rootDir, 0);
  return matches;
}

export function deleteLocalPath(
  rootDir: string,
  targetPath: string
): { deletedPath: string; kind: 'file' | 'folder' } {
  const cleanTarget = String(targetPath || '').trim();
  if (!cleanTarget || cleanTarget === '.' || cleanTarget === '/') {
    throw new Error('Cannot delete the root workspace folder itself.');
  }

  const { absolute, relative } = resolveSafeSubpath(rootDir, cleanTarget);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Target does not exist: ${relative}`);
  }

  const stat = fs.statSync(absolute);
  const kind = stat.isDirectory() ? 'folder' : 'file';
  fs.rmSync(absolute, { recursive: true, force: true });
  return { deletedPath: relative, kind };
}

export function patchLocalFile(
  rootDir: string,
  params: {
    targetPath: string;
    findText: string;
    replaceText: string;
    replaceAll?: boolean;
  }
): { patchedPath: string; replacements: number; sizeBytes: number } {
  const { absolute, relative } = resolveSafeSubpath(rootDir, params.targetPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${relative}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    throw new Error(`"${relative}" is a folder, not a file.`);
  }
  const findText = String(params.findText ?? '');
  if (!findText) {
    throw new Error('findText cannot be empty.');
  }
  const original = fs.readFileSync(absolute, 'utf-8');
  if (!original.includes(findText)) {
    throw new Error(
      `Could not find exact target snippet inside "${relative}". Read the file first to verify exact text.`
    );
  }

  let updated = original;
  let replacements = 0;
  if (params.replaceAll) {
    const parts = original.split(findText);
    replacements = parts.length - 1;
    updated = parts.join(String(params.replaceText ?? ''));
  } else {
    replacements = 1;
    updated = original.replace(findText, String(params.replaceText ?? ''));
  }

  fs.writeFileSync(absolute, updated, 'utf-8');
  return {
    patchedPath: relative,
    replacements,
    sizeBytes: Buffer.byteLength(updated, 'utf-8'),
  };
}

export async function runComputerCommand(
  rootDir: string,
  command: string,
  subDir = '',
  timeoutMs = 30000
): Promise<{
  ok: boolean;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const cleanCmd = String(command || '').trim();
  if (!cleanCmd) {
    throw new Error('Command cannot be empty.');
  }

  // Block destructive system-wide commands
  const lower = cleanCmd.toLowerCase();
  const blockedPatterns = [
    /\brm\s+-rf\s+\/(\s|$)/i,
    /\bformat\s+[a-z]:/i,
    /\bdel\s+\/[sqf].*\b[a-z]:\\/i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bmkfs\b/i,
  ];
  if (blockedPatterns.some((re) => re.test(lower))) {
    throw new Error('Destructive system-level command blocked for safety.');
  }

  const { absolute: cwdAbs, relative: cwdRel } = resolveSafeSubpath(
    rootDir,
    subDir
  );
  if (!fs.existsSync(cwdAbs) || !fs.statSync(cwdAbs).isDirectory()) {
    throw new Error(`Working directory not found: ${cwdRel}`);
  }

  const { exec } = await import('child_process');

  return new Promise((resolve) => {
    exec(
      cleanCmd,
      {
        cwd: cwdAbs,
        timeout: Math.min(Math.max(timeoutMs, 1000), 60000),
        maxBuffer: 1024 * 1024 * 2,
      },
      (err, stdout, stderr) => {
        const exitCode =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code ?? 1)
            : err
              ? 1
              : 0;
        resolve({
          ok: !err,
          cwd: cwdRel,
          exitCode,
          stdout: String(stdout || '').slice(0, 12000),
          stderr: String(stderr || '').slice(0, 8000),
        });
      }
    );
  });
}
