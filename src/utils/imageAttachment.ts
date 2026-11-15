import type { ChatAttachment } from '../types/arix';

const MAX_ATTACHMENTS = 4;
const MAX_DIMENSION = 1600;
const MAX_TEXT_CHARS = 35000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.xml',
  '.yml',
  '.yaml',
  '.env',
  '.log',
  '.sh',
  '.ps1',
  '.bat',
  '.toml',
  '.ini',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.php',
  '.rb',
]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function isTextOrCodeFile(file: File): boolean {
  if (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/javascript' ||
    file.type === 'application/xml'
  ) {
    return true;
  }
  const dotIdx = file.name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';
  return TEXT_EXTENSIONS.has(ext);
}

async function optimizeImageDataUrl(
  dataUrl: string,
  mimeType: string,
  fileSize: number
): Promise<{ dataUrl: string; mimeType: string }> {
  if (fileSize <= 650 * 1024 && mimeType !== 'image/heic') {
    return { dataUrl, mimeType };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height, 1));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, mimeType });
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outMime =
        mimeType === 'image/png' && fileSize < 1_400_000
          ? 'image/png'
          : 'image/jpeg';
      const compressed = canvas.toDataURL(outMime, 0.86);
      resolve({ dataUrl: compressed, mimeType: outMime });
    };
    img.onerror = () => resolve({ dataUrl, mimeType });
    img.src = dataUrl;
  });
}

export async function filesToChatAttachments(
  files: FileList | File[],
  existingCount = 0
): Promise<ChatAttachment[]> {
  const available = Math.max(0, MAX_ATTACHMENTS - existingCount);
  const candidateFiles = Array.from(files).slice(0, available);

  const results: ChatAttachment[] = [];
  for (const file of candidateFiles) {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (file.type.startsWith('image/')) {
      const rawDataUrl = await readFileAsDataUrl(file);
      const optimized = await optimizeImageDataUrl(
        rawDataUrl,
        file.type || 'image/png',
        file.size
      );
      results.push({
        id,
        name: file.name || 'image.png',
        mimeType: optimized.mimeType,
        kind: 'image',
        dataUrl: optimized.dataUrl,
        sizeBytes: file.size,
      });
    } else if (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    ) {
      if (file.size <= MAX_PDF_BYTES) {
        const pdfDataUrl = await readFileAsDataUrl(file);
        results.push({
          id,
          name: file.name || 'document.pdf',
          mimeType: 'application/pdf',
          kind: 'pdf',
          dataUrl: pdfDataUrl,
          sizeBytes: file.size,
        });
      }
    } else if (isTextOrCodeFile(file) && file.size <= 2 * 1024 * 1024) {
      const rawText = await readFileAsText(file);
      results.push({
        id,
        name: file.name || 'file.txt',
        mimeType: file.type || 'text/plain',
        kind: 'text',
        textContent: rawText.slice(0, MAX_TEXT_CHARS),
        sizeBytes: file.size,
      });
    }
  }
  return results;
}
