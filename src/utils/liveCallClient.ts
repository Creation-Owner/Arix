import type { ArixVoiceName } from '../types/arix';

export type LiveCallStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface LiveCallState {
  status: LiveCallStatus;
  muted: boolean;
  userTranscript: string;
  arixTranscript: string;
  error: string | null;
}

let state: LiveCallState = {
  status: 'idle',
  muted: false,
  userTranscript: '',
  arixTranscript: '',
  error: null,
};

const listeners = new Set<(next: LiveCallState) => void>();

function notify() {
  for (const fn of listeners) {
    fn(state);
  }
}

function setState(patch: Partial<LiveCallState>) {
  state = { ...state, ...patch };
  notify();
}

export function getLiveCallState(): LiveCallState {
  return state;
}

export function subscribeLiveCall(
  listener: (next: LiveCallState) => void
): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

let activeWs: WebSocket | null = null;
let inputAudioCtx: AudioContext | null = null;
let outputAudioCtx: AudioContext | null = null;
let micStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let mediaSource: MediaStreamAudioSourceNode | null = null;
let nextStartTime = 0;
const scheduledSources = new Set<AudioBufferSourceNode>();

function float32ToPcm16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function clearPlaybackQueue() {
  for (const src of scheduledSources) {
    try {
      src.stop();
    } catch {
      // Ignore already-stopped nodes
    }
  }
  scheduledSources.clear();
  if (outputAudioCtx) {
    nextStartTime = outputAudioCtx.currentTime;
  } else {
    nextStartTime = 0;
  }
}

function playPcmChunk(base64Audio: string) {
  if (!outputAudioCtx) return;
  if (outputAudioCtx.state === 'suspended') {
    void outputAudioCtx.resume();
  }
  const samples = base64Pcm16ToFloat32(base64Audio);
  if (samples.length === 0) return;

  const buffer = outputAudioCtx.createBuffer(1, samples.length, 24000);
  buffer.getChannelData(0).set(samples);

  const source = outputAudioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(outputAudioCtx.destination);

  const now = outputAudioCtx.currentTime;
  if (nextStartTime < now) {
    nextStartTime = now + 0.02;
  }
  source.start(nextStartTime);
  nextStartTime += buffer.duration;

  scheduledSources.add(source);
  source.onended = () => {
    scheduledSources.delete(source);
  };
}

export function stopLiveCall(): void {
  clearPlaybackQueue();

  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor.onaudioprocess = null;
    scriptProcessor = null;
  }
  if (mediaSource) {
    mediaSource.disconnect();
    mediaSource = null;
  }
  if (micStream) {
    for (const track of micStream.getTracks()) {
      track.stop();
    }
    micStream = null;
  }
  if (inputAudioCtx) {
    void inputAudioCtx.close().catch(() => {});
    inputAudioCtx = null;
  }
  if (outputAudioCtx) {
    void outputAudioCtx.close().catch(() => {});
    outputAudioCtx = null;
  }
  if (activeWs) {
    try {
      activeWs.close();
    } catch {
      // Ignore close errors
    }
    activeWs = null;
  }

  setState({
    status: 'idle',
    muted: false,
  });
}

export function toggleLiveCallMute(): void {
  setState({ muted: !state.muted });
}

export async function startLiveCall(voiceName: ArixVoiceName): Promise<void> {
  if (state.status === 'live' || state.status === 'connecting') {
    stopLiveCall();
    return;
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof AudioContext === 'undefined'
  ) {
    setState({
      status: 'error',
      error: 'Live audio streaming is not supported in this browser.',
    });
    return;
  }

  setState({
    status: 'connecting',
    muted: false,
    userTranscript: '',
    arixTranscript: '',
    error: null,
  });

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    inputAudioCtx = new AudioContext({ sampleRate: 16000 });
    outputAudioCtx = new AudioContext({ sampleRate: 24000 });
    nextStartTime = outputAudioCtx.currentTime;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/live?voice=${encodeURIComponent(voiceName)}`;
    const ws = new WebSocket(wsUrl);
    activeWs = ws;

    ws.onopen = () => {
      if (!inputAudioCtx || !micStream) return;
      mediaSource = inputAudioCtx.createMediaStreamSource(micStream);
      scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (ev) => {
        if (state.muted || ws.readyState !== WebSocket.OPEN) return;
        const channel = ev.inputBuffer.getChannelData(0);
        const base64 = float32ToPcm16Base64(channel);
        ws.send(JSON.stringify({ audio: base64 }));
      };
      mediaSource.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioCtx.destination);
      setState({ status: 'live', error: null });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          audio?: string;
          interrupted?: boolean;
          inputTranscript?: string;
          outputTranscript?: string;
          error?: string;
        };
        if (msg.error) {
          setState({ status: 'error', error: msg.error });
          stopLiveCall();
          return;
        }
        if (msg.interrupted) {
          clearPlaybackQueue();
        }
        if (msg.inputTranscript) {
          setState({ userTranscript: msg.inputTranscript });
        }
        if (msg.outputTranscript) {
          setState({
            arixTranscript: state.arixTranscript
              ? `${state.arixTranscript} ${msg.outputTranscript}`
              : msg.outputTranscript,
          });
        }
        if (msg.audio) {
          playPcmChunk(msg.audio);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onerror = () => {
      setState({
        status: 'error',
        error: 'Live voice connection failed.',
      });
      stopLiveCall();
    };

    ws.onclose = () => {
      if (activeWs === ws) {
        stopLiveCall();
      }
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unable to start live voice call.';
    stopLiveCall();
    setState({ status: 'error', error: msg });
  }
}
