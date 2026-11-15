import type { ArixVoiceName } from '../types/arix';

export interface ArixVoiceOption {
  id: ArixVoiceName;
  label: string;
  tagline: string;
}

export const ARIX_VOICES: ArixVoiceOption[] = [
  { id: 'Kore', label: 'Kore', tagline: 'Balanced & Warm' },
  { id: 'Puck', label: 'Puck', tagline: 'Bright & Energetic' },
  { id: 'Charon', label: 'Charon', tagline: 'Deep & Calm' },
  { id: 'Fenrir', label: 'Fenrir', tagline: 'Bold & Expressive' },
  { id: 'Zephyr', label: 'Zephyr', tagline: 'Smooth & Crisp' },
];

export interface VoicePlaybackState {
  loadingId: string | null;
  playingId: string | null;
  error: string | null;
}

let state: VoicePlaybackState = {
  loadingId: null,
  playingId: null,
  error: null,
};

let currentAudio: HTMLAudioElement | null = null;
const listeners = new Set<(next: VoicePlaybackState) => void>();

function notify() {
  for (const fn of listeners) {
    fn(state);
  }
}

function setState(patch: Partial<VoicePlaybackState>) {
  state = { ...state, ...patch };
  notify();
}

export function getVoicePlaybackState(): VoicePlaybackState {
  return state;
}

export function subscribeVoicePlayback(
  listener: (next: VoicePlaybackState) => void
): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function stopArixSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  setState({ loadingId: null, playingId: null });
}

export async function playArixSpeech(params: {
  id: string;
  text: string;
  voiceName: ArixVoiceName;
}): Promise<void> {
  const { id, text, voiceName } = params;

  if (state.playingId === id || state.loadingId === id) {
    stopArixSpeech();
    return;
  }

  stopArixSpeech();
  setState({ loadingId: id, playingId: null, error: null });

  try {
    const res = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
    });
    const data = await res.json();
    if (!res.ok || !data.audioBase64) {
      throw new Error(data.error || 'Unable to generate voice audio.');
    }

    // Check if user cancelled while loading
    if (state.loadingId !== id) return;

    const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
    currentAudio = audio;
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      setState({ loadingId: null, playingId: null });
    };
    audio.onerror = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      setState({
        loadingId: null,
        playingId: null,
        error: 'Audio playback failed.',
      });
    };

    setState({ loadingId: null, playingId: id, error: null });
    await audio.play();
  } catch (err) {
    // Fallback to browser SpeechSynthesis if offline/unavailable
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const cleanText = text
          .replace(/```[\s\S]*?```/g, ' Code included in chat. ')
          .replace(/[#*_`>]/g, ' ')
          .slice(0, 1200);
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.onend = () => setState({ loadingId: null, playingId: null });
        utter.onerror = () => setState({ loadingId: null, playingId: null });
        setState({ loadingId: null, playingId: id, error: null });
        window.speechSynthesis.speak(utter);
        return;
      } catch {
        // Fall through to error state
      }
    }
    setState({
      loadingId: null,
      playingId: null,
      error: err instanceof Error ? err.message : 'Voice playback error.',
    });
  }
}

export async function previewArixVoice(
  voiceName: ArixVoiceName
): Promise<void> {
  const voice = ARIX_VOICES.find((v) => v.id === voiceName);
  const sampleText = `Hello! I am Arix speaking with the ${
    voice?.label || voiceName
  } voice. Tell me what you want to build, inspect, or solve next.`;
  await playArixSpeech({
    id: `preview-${voiceName}`,
    text: sampleText,
    voiceName,
  });
}
