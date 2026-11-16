import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Cpu,
  FileText,
  Globe,
  Link2,
  Loader2,
  Mic,
  MicOff,
  MonitorDown,
  Paperclip,
  Phone,
  PhoneOff,
  Send,
  Sparkles,
  Square,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import { ArixCore3D } from './ArixCore3D';
import { SelfSectionFrame } from './SelfSectionFrame';
import { filesToChatAttachments } from '../utils/imageAttachment';
import {
  getLiveCallState,
  startLiveCall,
  stopLiveCall,
  subscribeLiveCall,
  toggleLiveCallMute,
  type LiveCallState,
} from '../utils/liveCallClient';
import {
  ARIX_VOICES,
  getVoicePlaybackState,
  playArixSpeech,
  subscribeVoicePlayback,
  type VoicePlaybackState,
} from '../utils/voicePlayer';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  transcribeVoiceAudio,
  type VoiceRecorderSession,
} from '../utils/voiceRecorder';
import type {
  ArixLiveStatus,
  ArixSatelliteKey,
  ArixVoiceName,
  ChatAttachment,
  ChatMessage,
  CustomSection,
} from '../types/arix';

interface MainPageProps {
  connectedCount: number;
  activeRuleCount: number;
  auditCount: number;
  chatCount: number;
  ownerName: string;
  voiceName: ArixVoiceName;
  liveStatus: ArixLiveStatus;
  sendingCommand: boolean;
  latestArixReply: ChatMessage | null;
  customSections: CustomSection[];
  onSendCommand: (
    message: string,
    attachments?: ChatAttachment[]
  ) => Promise<void>;
  onChangeVoice: (voiceName: ArixVoiceName) => Promise<void>;
  onDeleteSection: (id: string) => Promise<void>;
  onAskArixToModifySection: (section: CustomSection) => void;
  onOpenDesktopAppModal: () => void;
  onNavigate: (
    tab: 'connections' | 'computer' | 'analyze' | 'ask' | 'teach' | 'history'
  ) => void;
}

export function MainPage({
  connectedCount,
  activeRuleCount,
  auditCount,
  chatCount,
  ownerName,
  voiceName,
  liveStatus,
  sendingCommand,
  latestArixReply,
  customSections,
  onSendCommand,
  onChangeVoice,
  onDeleteSection,
  onAskArixToModifySection,
  onOpenDesktopAppModal,
  onNavigate,
}: MainPageProps) {
  const [commandInput, setCommandInput] = useState('');
  const [pendingImages, setPendingImages] = useState<ChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [voiceInputError, setVoiceInputError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceState, setVoiceState] = useState<VoicePlaybackState>(() =>
    getVoicePlaybackState()
  );
  const [liveCall, setLiveCall] = useState<LiveCallState>(() =>
    getLiveCallState()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<VoiceRecorderSession | null>(null);

  const voiceSupported = isVoiceRecordingSupported();

  useEffect(() => {
    return subscribeVoicePlayback(setVoiceState);
  }, []);

  useEffect(() => {
    return subscribeLiveCall(setLiveCall);
  }, []);

  useEffect(() => {
    if (!listening) {
      setRecordSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  const startListening = async () => {
    setVoiceInputError(null);
    try {
      const session = await startVoiceRecording();
      recorderRef.current = session;
      setListening(true);
    } catch (err) {
      setVoiceInputError(
        err instanceof Error ? err.message : 'Unable to start microphone.'
      );
    }
  };

  const finishListening = async (autoSend: boolean) => {
    const session = recorderRef.current;
    recorderRef.current = null;
    setListening(false);
    if (!session) return;

    setTranscribingVoice(true);
    setVoiceInputError(null);
    try {
      const audio = await session.stop();
      const transcript = await transcribeVoiceAudio(audio);
      if (!transcript) {
        setVoiceInputError(
          'No speech detected. Try speaking closer to the microphone.'
        );
        return;
      }
      if (autoSend) {
        const combined = commandInput.trim()
          ? `${commandInput.trim()} ${transcript}`
          : transcript;
        const imagesToSend = pendingImages;
        setCommandInput('');
        setPendingImages([]);
        await onSendCommand(combined, imagesToSend);
      } else {
        setCommandInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    } catch (err) {
      setVoiceInputError(
        err instanceof Error ? err.message : 'Voice command failed.'
      );
    } finally {
      setTranscribingVoice(false);
    }
  };

  const cancelListening = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setListening(false);
  };

  const toggleVoiceInput = () => {
    if (transcribingVoice) return;
    if (listening) {
      void finishListening(true);
    } else {
      void startListening();
    }
  };

  const handleAttachFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const added = await filesToChatAttachments(files, pendingImages.length);
    if (added.length > 0) {
      setPendingImages((prev) => [...prev, ...added].slice(0, 4));
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleAttachFiles(e.target.files);
    e.target.value = '';
  };

  const handlePaste = async (e: ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleAttachFiles(imageFiles);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!commandInput.trim() && pendingImages.length === 0) || sendingCommand)
      return;
    const text = commandInput.trim();
    const imagesToSend = pendingImages;
    setCommandInput('');
    setPendingImages([]);
    await onSendCommand(text, imagesToSend);
  };

  const handleSatelliteSelect = (node: ArixSatelliteKey) => {
    if (node === 'code') {
      onNavigate('connections');
    } else if (node === 'compute') {
      onNavigate('computer');
    } else if (node === 'text') {
      onNavigate('teach');
    } else if (node === 'network') {
      onNavigate('connections');
    } else {
      onNavigate('ask');
    }
  };

  const quickCommands = [
    'Create a 6-slide presentation on AI Automation with .pptx export',
    'Create a Quick Tasks & Timer section in yourself',
    'Add arix-notes.md to my GitHub',
    'Create folder "demo-project" with README.txt inside',
    'Send a live status update to my Telegram',
    'Inspect cloudflare.com DNS and headers',
  ];

  const capabilities = [
    {
      num: '01.',
      title: 'Connect Websites, GitHub, Cloudflare & Telegram',
      description:
        'Link GitHub repositories, Cloudflare domains, Telegram bots, live websites, and custom APIs so Arix inspects, writes commits, and sends alerts directly.',
      actionLabel: 'Connect Sites & Bots',
      target: 'connections' as const,
      icon: Link2,
    },
    {
      num: '02.',
      title: 'Computer Files & Folder Control',
      description:
        'Create files or folders, search contents, read code, and delete items inside your configured computer directory from Command Chat or the file browser.',
      actionLabel: 'Open Computer Files',
      target: 'computer' as const,
      icon: Cpu,
    },
    {
      num: '03.',
      title: 'Teach From Zero to Everything',
      description:
        'Start from a clean slate or build structured rules across coding, UX analysis, GitHub, Cloudflare, and custom owner directives.',
      actionLabel: 'Teach Arix',
      target: 'teach' as const,
      icon: BookOpen,
    },
    {
      num: '04.',
      title: 'Coding, Debugging & UX Analysis',
      description:
        'Audit any website for errors and UX impact (P0–P3), generate complete Before/After fixes, or command Arix in natural language.',
      actionLabel: 'Analyze Website',
      target: 'analyze' as const,
      icon: Globe,
    },
  ];

  const recentEvents = liveStatus.events.slice(-4).reverse();
  const mainPageSections = customSections.filter(
    (s) => s.placement === 'main_page' || s.placement === 'both'
  );

  return (
    <div className="space-y-8">
      {/* Live 3D Arix Core Hero + Direct Command Bar */}
      <section className="bg-[#081226] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {/* Top Heading Strip */}
        <div className="px-6 py-4 border-b border-slate-800/90 bg-[#071022] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-medium">
              <span>Arix Autonomous Core</span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300">
                Owner: {ownerName || 'Owner'}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-400">Local Desktop Edition</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Command Arix &amp; Watch Live 3D Execution
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('connections')}
              className="px-3.5 py-2 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Connect GitHub / Site / Bot
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ask')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Full Command Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Always-Moving 3D Neural Sphere & Satellite Task Nodes */}
        <ArixCore3D
          liveStatus={liveStatus}
          connectedCount={connectedCount}
          activeRuleCount={activeRuleCount}
          onSelectSatellite={handleSatelliteSelect}
        />

        {/* Docked Main Page Command Composer */}
        <div className="p-5 sm:p-6 border-t border-slate-800/90 bg-[#071022] space-y-4">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {pendingImages.map((att) => (
                <div
                  key={att.id}
                  className="relative rounded-lg overflow-hidden border border-slate-700 bg-[#060E1F]"
                >
                  {att.dataUrl &&
                  (att.kind === 'image' || att.mimeType.startsWith('image/')) ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-14 w-14 object-cover block"
                    />
                  ) : (
                    <div className="h-14 px-3 pr-7 flex items-center gap-2 text-xs text-slate-200 max-w-[180px]">
                      <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{att.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingImages((prev) =>
                        prev.filter((item) => item.id !== att.id)
                      )
                    }
                    aria-label={`Remove ${att.name}`}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-slate-950/85 text-slate-200 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(listening || transcribingVoice || voiceInputError) && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
                voiceInputError
                  ? 'bg-red-950/35 border-red-500/40 text-red-300'
                  : 'bg-[#060E1F] border-sky-500/40 text-slate-200'
              }`}
            >
              {voiceInputError ? (
                <>
                  <span>{voiceInputError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceInputError(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Dismiss
                  </button>
                </>
              ) : transcribingVoice ? (
                <div className="flex items-center gap-2 text-sky-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Transcribing voice command with Gemini...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium text-white">
                      Listening · {Math.floor(recordSeconds / 60)}:
                      {String(recordSeconds % 60).padStart(2, '0')}
                    </span>
                    <span className="text-slate-400 hidden sm:inline">
                      Speak your command clearly
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void finishListening(true)}
                      className="px-2.5 py-1 bg-sky-500 text-slate-950 font-semibold rounded hover:bg-sky-400 cursor-pointer"
                    >
                      Send Voice
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishListening(false)}
                      className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded hover:bg-slate-700 cursor-pointer"
                    >
                      To Box
                    </button>
                    <button
                      type="button"
                      onClick={cancelListening}
                      className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {liveCall.status !== 'idle' && (
            <div
              className={`px-3.5 py-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2.5 ${
                liveCall.status === 'error'
                  ? 'bg-red-950/40 border-red-500/40 text-red-200'
                  : 'bg-[#060E1F] border-emerald-500/40 text-slate-200'
              }`}
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      liveCall.status === 'live'
                        ? 'bg-emerald-400 animate-pulse'
                        : liveCall.status === 'error'
                          ? 'bg-red-400'
                          : 'bg-sky-400 animate-pulse'
                    }`}
                  />
                  <span>
                    {liveCall.status === 'connecting'
                      ? `Connecting live voice call (${voiceName})...`
                      : liveCall.status === 'error'
                        ? liveCall.error
                        : `Live Call Active · ${voiceName}`}
                  </span>
                </div>
                {(liveCall.userTranscript || liveCall.arixTranscript) && (
                  <div className="text-[11px] text-slate-300 truncate">
                    {liveCall.arixTranscript
                      ? `Arix: ${liveCall.arixTranscript.slice(-140)}`
                      : `You: ${liveCall.userTranscript}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {liveCall.status === 'live' && (
                  <button
                    type="button"
                    onClick={toggleLiveCallMute}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-slate-200 hover:border-slate-500 cursor-pointer"
                  >
                    {liveCall.muted ? (
                      <MicOff className="w-3 h-3" />
                    ) : (
                      <Mic className="w-3 h-3" />
                    )}
                    <span>{liveCall.muted ? 'Muted' : 'Mute'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopLiveCall}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 cursor-pointer"
                >
                  <PhoneOff className="w-3 h-3" />
                  <span>{liveCall.status === 'error' ? 'Close' : 'End'}</span>
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.sql,.log,.yml,.yaml,.xml"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingCommand || pendingImages.length >= 4}
                title="Attach image, PDF, or code/text file (or Ctrl+V)"
                aria-label="Attach image, PDF, or file to command"
                className="inline-flex items-center justify-center px-3.5 py-3 bg-[#060E1F] border border-slate-700 text-slate-200 hover:text-sky-300 hover:border-sky-500/60 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={sendingCommand || transcribingVoice}
                  title={
                    listening
                      ? 'Stop & send voice command'
                      : 'Give a command by voice'
                  }
                  aria-label={
                    listening
                      ? 'Stop and send voice command'
                      : 'Speak voice command'
                  }
                  className={`inline-flex items-center justify-center px-3.5 py-3 border rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    listening
                      ? 'bg-red-500/20 border-red-500 text-red-300'
                      : 'bg-[#060E1F] border-slate-700 text-slate-200 hover:text-sky-300 hover:border-sky-500/60 disabled:opacity-40'
                  }`}
                >
                  {transcribingVoice ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  ) : listening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  liveCall.status === 'live' || liveCall.status === 'connecting'
                    ? stopLiveCall()
                    : void startLiveCall(voiceName)
                }
                title="Start or end a real-time two-way voice call with Arix"
                aria-label="Toggle Live Voice Call"
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-3 border rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  liveCall.status === 'live' || liveCall.status === 'connecting'
                    ? 'bg-red-500/20 border-red-500 text-red-200'
                    : 'bg-[#060E1F] border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15'
                }`}
              >
                {liveCall.status === 'connecting' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : liveCall.status === 'live' ? (
                  <PhoneOff className="w-4 h-4" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {liveCall.status === 'live' ? 'End Call' : 'Live Call'}
                </span>
              </button>
            </div>
            <label htmlFor="main-arix-command" className="sr-only">
              Command Arix directly
            </label>
            <input
              id="main-arix-command"
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onPaste={handlePaste}
              placeholder='Command Arix or paste an image (Ctrl+V) — e.g. "Fix this error screenshot", "Create presentation"...'
              className="flex-1 px-4 py-3 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/35 focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={
                sendingCommand ||
                (!commandInput.trim() && pendingImages.length === 0)
              }
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sendingCommand ? 'Executing...' : 'Run with Arix'}</span>
            </button>
          </form>

          {/* Live Step Trail + Latest Reply (Placed directly below command bar, never truncated) */}
          {(sendingCommand || recentEvents.length > 0 || latestArixReply) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {recentEvents.length > 0 && (
                <div className="lg:col-span-5 bg-[#060E1F] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-sky-300">
                    Live 3D Activity Log
                  </div>
                  <div className="space-y-1.5">
                    {recentEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-2 text-xs border-b border-slate-800/70 pb-1.5 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <div
                            className={`font-medium break-words ${
                              ev.phase === 'error'
                                ? 'text-red-300'
                                : ev.phase === 'done' || ev.phase === 'tool_done'
                                  ? 'text-emerald-300'
                                  : 'text-cyan-200'
                            }`}
                          >
                            {ev.title}
                          </div>
                          <div className="text-slate-400 break-words font-mono text-[11px]">
                            {ev.detail}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 tabular-nums">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(sendingCommand || latestArixReply) && (
                <div
                  className={`${
                    recentEvents.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                  } bg-[#060E1F] border border-sky-500/30 rounded-xl p-4 space-y-2.5`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <span>Latest Arix Response</span>
                      {sendingCommand && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-normal text-sky-300">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Thinking...</span>
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Select Arix voice"
                        value={voiceName}
                        onChange={(e) =>
                          void onChangeVoice(e.target.value as ArixVoiceName)
                        }
                        className="px-2 py-1 text-[11px] bg-[#0B152B] border border-slate-700 text-slate-200 rounded-md cursor-pointer"
                      >
                        {ARIX_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} ({v.tagline})
                          </option>
                        ))}
                      </select>
                      {latestArixReply && (
                        <button
                          type="button"
                          onClick={() =>
                            void playArixSpeech({
                              id: latestArixReply.id,
                              text: latestArixReply.content,
                              voiceName,
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                            voiceState.playingId === latestArixReply.id ||
                            voiceState.loadingId === latestArixReply.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                              : 'bg-[#0B152B] border-slate-700 text-slate-200 hover:border-sky-500/60'
                          }`}
                        >
                          {voiceState.loadingId === latestArixReply.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Loading</span>
                            </>
                          ) : voiceState.playingId === latestArixReply.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Speak</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate('ask')}
                        className="text-xs text-sky-400 hover:underline cursor-pointer"
                      >
                        Open Full Chat
                      </button>
                    </div>
                  </div>
                  {latestArixReply ? (
                    <>
                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto pr-1">
                        {latestArixReply.content}
                      </div>
                      {latestArixReply.toolsInvoked &&
                        latestArixReply.toolsInvoked.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-mono pt-1 border-t border-slate-800/80">
                            <Wrench className="w-3 h-3 shrink-0" />
                            <span>
                              {latestArixReply.toolsInvoked.join(' · ')}
                            </span>
                          </div>
                        )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Arix is processing your command...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Command Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Try live:</span>
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                disabled={sendingCommand}
                onClick={() => onSendCommand(cmd)}
                className="px-3 py-1.5 text-xs text-slate-200 bg-[#0B152B] hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Live Workspace Metrics Strip */}
      <section
        aria-label="Workspace overview metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: 'Connected Websites & APIs',
            value: connectedCount,
            action: () => onNavigate('connections'),
            hint: 'GitHub, Cloudflare & URLs',
          },
          {
            label: 'Taught Rules & Skills',
            value: activeRuleCount,
            action: () => onNavigate('teach'),
            hint: 'Active owner instructions',
          },
          {
            label: 'Completed Site Audits',
            value: auditCount,
            action: () => onNavigate('analyze'),
            hint: 'UX impact prioritized',
          },
          {
            label: 'Command Chat Messages',
            value: chatCount,
            action: () => onNavigate('ask'),
            hint: 'Coding & live tool runs',
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="text-left bg-[#0B152B] border border-slate-800/90 hover:border-sky-500/50 rounded-xl p-5 transition-colors cursor-pointer"
          >
            <div className="text-xs text-slate-400">{item.label}</div>
            <div className="mt-2 text-2xl font-display font-bold text-white font-mono tabular-nums">
              {item.value}
            </div>
            <div className="mt-1 text-xs text-sky-400">{item.hint}</div>
          </button>
        ))}
      </section>

      {/* Core Capabilities */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.num}
              className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-sky-400 font-medium">
                    {cap.num}
                  </span>
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="text-base font-display font-semibold text-white">
                  {cap.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {cap.description}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onNavigate(cap.target)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  <span>{cap.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Self-Built Sections Pinned to Main Page */}
      {mainPageSections.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-display font-semibold text-white">
                Self-Built Arix Sections
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {mainPageSections.length}{' '}
              {mainPageSections.length === 1 ? 'section' : 'sections'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5">
            {mainPageSections.map((section) => (
              <SelfSectionFrame
                key={section.id}
                section={section}
                compact
                onAskArixToModify={onAskArixToModifySection}
                onDeleteSection={onDeleteSection}
              />
            ))}
          </div>
        </section>
      )}

      {/* Standalone Desktop App & Brain Portability Notice */}
      <section className="bg-[#0B152B] border border-slate-800/90 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Code2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-display font-semibold text-white">
              Standalone App Mode &amp; VS Code GitHub Installer Ready
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
              Run Arix as its own dedicated Desktop App (no localhost browser
              address bar), pull updates straight from your GitHub repo in VS
              Code, or export Arix&apos;s complete brain and self-built sections
              to move between devices.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenDesktopAppModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MonitorDown className="w-3.5 h-3.5" />
            <span>Desktop App &amp; VS Code Setup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('teach')}
            className="px-4 py-2 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Manage Brain &amp; Export
          </button>
        </div>
      </section>
    </div>
  );
}
