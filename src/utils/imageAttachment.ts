import type { ChatAttachment } from '../types/arix';

const MAX_ATTACHMENTS = 4;
const MAX_DIMENSION = 1600;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function optimizeImageDataUrl(
  dataUrl: string,
  mimeType: string,
  fileSize: number
): Promise<{ dataUrl: string; mimeType: string }> {
  // Keep crisp small screenshots/diagrams untouched
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
      const outMime = mimeType === 'image/png' && fileSize < 1_400_000
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
  const imageFiles = Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .slice(0, available);

  const results: ChatAttachment[] = [];
  for (const file of imageFiles) {
    const rawDataUrl = await readFileAsDataUrl(file);
    const optimized = await optimizeImageDataUrl(
      rawDataUrl,
      file.type || 'image/png',
      file.size
    );
    results.push({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name || 'pasted-image.png',
      mimeType: optimized.mimeType,
      dataUrl: optimized.dataUrl,
    });
  }
  return results;
}
