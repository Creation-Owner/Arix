import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Search,
  Trash2,
  ArrowLeft,
  FilePlus2,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import type { ComputerEntry } from '../types/arix';

interface ComputerWorkspaceProps {
  computerRoot: string;
  onUpdateRoot: (newRoot: string) => Promise<void>;
}

export function ComputerWorkspace({
  computerRoot,
  onUpdateRoot,
}: ComputerWorkspaceProps) {
  const [rootDraft, setRootDraft] = useState(computerRoot);
  const [savingRoot, setSavingRoot] = useState(false);
  const [rootMsg, setRootMsg] = useState<string | null>(null);

  const [currentPath, setCurrentPath] = useState('.');
  const [entries, setEntries] = useState<ComputerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createKind, setCreateKind] = useState<'file' | 'folder'>('file');
  const [newPath, setNewPath] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<Array<{
    relativePath: string;
    type: 'file' | 'directory';
    matchReason: 'name' | 'content';
    sizeBytes: number;
  }> | null>(null);

  const [previewFile, setPreviewFile] = useState<{
    path: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    setRootDraft(computerRoot);
  }, [computerRoot]);

  const loadEntries = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = dirPath && dirPath !== '.' ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await fetch(`/api/computer/files${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to read directory.');
      setCurrentPath(data.currentPath || '.');
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to list files.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries('.');
  }, [computerRoot, loadEntries]);

  const handleSaveRoot = async (e: FormEvent) => {
    e.preventDefault();
    setSavingRoot(true);
    setRootMsg(null);
    setError(null);
    try {
      await onUpdateRoot(rootDraft);
      setRootMsg('Active computer workspace folder updated.');
      setTimeout(() => setRootMsg(null), 2500);
      await loadEntries('.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update path.');
    } finally {
      setSavingRoot(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const target =
        currentPath && currentPath !== '.'
          ? `${currentPath}/${newPath.trim()}`
          : newPath.trim();
      const res = await fetch('/api/computer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPath: target,
          kind: createKind,
          content: createKind === 'file' ? newContent : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Creation failed.');
      setNewPath('');
      setNewContent('');
      await loadEntries(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (relPath: string) => {
    setError(null);
    const res = await fetch('/api/computer/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: relPath }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Delete failed.');
      return;
    }
    if (previewFile?.path === relPath) setPreviewFile(null);
    await loadEntries(currentPath);
    if (searchMatches) {
      setSearchMatches(searchMatches.filter((m) => m.relativePath !== relPath));
    }
  };

  const handleOpenFile = async (relPath: string) => {
    const res = await fetch(
      `/api/computer/read?path=${encodeURIComponent(relPath)}`
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Unable to read file.');
      return;
    }
    setPreviewFile({ path: data.path, content: data.content });
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchMatches(null);
      return;
    }
    const res = await fetch(
      `/api/computer/find?q=${encodeURIComponent(searchQuery.trim())}`
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Search failed.');
      return;
    }
    setSearchMatches(data.matches || []);
  };

  const navigateUp = () => {
    if (currentPath === '.' || !currentPath) return;
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    parts.pop();
    loadEntries(parts.length > 0 ? parts.join('/') : '.');
  };

  return (
    <div className="space-y-6">
      {/* Root Folder Configuration */}
      <form
        onSubmit={handleSaveRoot}
        className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Host Computer Folder Access
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Arix creates, searches, reads, and deletes files inside this
                root directory. When running on your own computer, set this to
                your Desktop, Documents, or project folder (or configure{' '}
                <code className="text-sky-300">ARIX_COMPUTER_ROOT</code> in{' '}
                <code className="text-sky-300">.env</code>).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={rootDraft}
            onChange={(e) => setRootDraft(e.target.value)}
            aria-label="Host computer root folder path"
            className="flex-1 px-3.5 py-2 text-xs font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <button
            type="submit"
            disabled={savingRoot}
            className="px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {savingRoot ? 'Updating...' : 'Set Root Folder'}
          </button>
        </div>
        {rootMsg && <p className="text-xs text-emerald-400">{rootMsg}</p>}
      </form>

      {error && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-950/30 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Create File / Folder + Search */}
        <div className="xl:col-span-5 space-y-6">
          <form
            onSubmit={handleCreate}
            className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-white">
                Create File or Folder
              </h3>
              <div className="flex items-center gap-1 p-1 bg-[#060E1F] border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCreateKind('file')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    createKind === 'file'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateKind('folder')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    createKind === 'folder'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Folder</span>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-item-path"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                {createKind === 'folder' ? 'Folder Name / Path' : 'File Name / Path'}
              </label>
              <input
                id="new-item-path"
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder={
                  createKind === 'folder'
                    ? 'e.g. projects/website-v2'
                    : 'e.g. notes/todo.txt'
                }
                required
                className="w-full px-3 py-2 text-sm font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg"
              />
            </div>

            {createKind === 'file' && (
              <div>
                <label
                  htmlFor="new-file-content"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  File Contents
                </label>
                <textarea
                  id="new-file-content"
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write text or code to save inside the file..."
                  className="w-full px-3 py-2 text-xs font-mono bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={creating || !newPath.trim()}
              className="w-full py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
            >
              {creating
                ? 'Creating...'
                : createKind === 'folder'
                  ? 'Create Folder'
                  : 'Create File'}
            </button>
          </form>

          {/* Find Files */}
          <form
            onSubmit={handleSearch}
            className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 space-y-3"
          >
            <h3 className="text-sm font-display font-semibold text-white">
              Find Files or Content
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search filenames or text inside files..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#060E1F] border border-slate-700 text-white rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                Find
              </button>
              {searchMatches && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchMatches(null);
                  }}
                  className="px-2.5 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {searchMatches && (
              <div className="pt-2 divide-y divide-slate-800 text-xs max-h-60 overflow-y-auto">
                {searchMatches.length === 0 ? (
                  <p className="text-slate-400 py-2">No matching files found.</p>
                ) : (
                  searchMatches.map((m) => (
                    <div
                      key={m.relativePath}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          m.type === 'directory'
                            ? loadEntries(m.relativePath)
                            : handleOpenFile(m.relativePath)
                        }
                        className="text-left font-mono text-sky-300 hover:underline truncate cursor-pointer"
                      >
                        {m.relativePath}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">{m.matchReason}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.relativePath)}
                          aria-label={`Delete ${m.relativePath}`}
                          className="text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </form>
        </div>

        {/* Right: Directory Explorer & File Preview */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[#0B152B] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentPath !== '.' && (
                  <button
                    type="button"
                    onClick={navigateUp}
                    className="p-1.5 text-slate-300 hover:text-white border border-slate-700 rounded-md cursor-pointer"
                    aria-label="Go up one folder"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">Current Folder</div>
                  <div className="text-sm font-mono text-white truncate">
                    {currentPath === '.' ? '/' : `/${currentPath}`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadEntries(currentPath)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-xs text-slate-400">Loading files...</div>
            ) : entries.length === 0 ? (
              <div className="p-10 text-center space-y-1.5">
                <p className="text-sm font-medium text-white">
                  This folder is empty
                </p>
                <p className="text-xs text-slate-400">
                  Ask Arix in Command Chat to create files/folders here, or use
                  the form on the left.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {entries.map((entry) => (
                  <div
                    key={entry.relativePath}
                    className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        entry.type === 'directory'
                          ? loadEntries(entry.relativePath)
                          : handleOpenFile(entry.relativePath)
                      }
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      {entry.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-sm font-mono text-white hover:text-sky-300 truncate">
                        {entry.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
                      <span className="font-mono tabular-nums">
                        {entry.type === 'directory'
                          ? 'Folder'
                          : `${entry.sizeBytes} B`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.relativePath)}
                        aria-label={`Delete ${entry.name}`}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-md hover:bg-red-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {previewFile && (
            <CodeBlock
              label={`Preview: ${previewFile.path}`}
              code={previewFile.content}
            />
          )}
        </div>
      </div>
    </div>
  );
}
