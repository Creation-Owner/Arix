export interface RecordedAudioPayload {
  audioBase64: string;
  mimeType: string;
}

export interface VoiceRecorderSession {
  stop: () => Promise<RecordedAudioPayload>;
  cancel: () => void;
  mimeType: string;
}

function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export async function startVoiceRecording(): Promise<VoiceRecorderSession> {
  if (!isVoiceRecordingSupported()) {
    throw new Error(
      'Microphone recording is not supported in this browser or window.'
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow mic access in your browser/app settings and try again.'
        : err instanceof Error
          ? err.message
          : 'Unable to access microphone.';
    throw new Error(msg);
  }

  const preferredMime = pickSupportedAudioMimeType();
  const recorder = preferredMime
    ? new MediaRecorder(stream, { mimeType: preferredMime })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const stopTracks = () => {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  };

  recorder.start(200);

  return {
    mimeType: recorder.mimeType || preferredMime || 'audio/webm',
    stop: () =>
      new Promise<RecordedAudioPayload>((resolve, reject) => {
        if (recorder.state === 'inactive') {
          stopTracks();
          reject(new Error('Recording was already stopped.'));
          return;
        }
        recorder.onstop = async () => {
          stopTracks();
          try {
            const actualMime =
              recorder.mimeType || preferredMime || 'audio/webm';
            const blob = new Blob(chunks, { type: actualMime });
            if (blob.size < 400) {
              reject(new Error('Recording was too short. Please speak clearly and try again.'));
              return;
            }
            const audioBase64 = await blobToBase64(blob);
            resolve({
              audioBase64,
              mimeType: actualMime.split(';')[0] || 'audio/webm',
            });
          } catch (err) {
            reject(
              err instanceof Error
                ? err
                : new Error('Failed to process recorded audio.')
            );
          }
        };
        recorder.onerror = () => {
          stopTracks();
          reject(new Error('Audio recording failed.'));
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') {
          recorder.onstop = null;
          recorder.stop();
        }
      } finally {
        stopTracks();
      }
    },
  };
}

export async function transcribeVoiceAudio(
  payload: RecordedAudioPayload
): Promise<string> {
  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Voice transcription failed.');
  }
  return String(data.transcript || '').trim();
}
