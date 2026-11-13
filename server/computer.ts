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
