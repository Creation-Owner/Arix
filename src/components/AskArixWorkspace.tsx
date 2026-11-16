import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  PhoneOff,
  Play,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ArixAvatar } from './ArixAvatar';
import { CodeBlock } from './CodeBlock';
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
  previewArixVoice,
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
  ArixVoiceName,
  ChatAttachment,
  ChatMessage,
  ConnectedSite,
  ReasoningMode,
  WebsiteAudit,
} from '../types/arix';

interface AskArixWorkspaceProps {
  messages: ChatMessage[];
  audits: WebsiteAudit[];
  connections: ConnectedSite[];
  selectedAuditId: string | null;
  focusedIssueId: string | null;
  selectedConnectionId: string | null;
  sending: boolean;
  reasoningMode: ReasoningMode;
  voiceName: ArixVoiceName;
  autoSpeak: boolean;
  activeRuleCount: number;
  draftPrompt?: string | null;
  onConsumeDraftPrompt?: () => void;
  onChangeReasoningMode: (mode: ReasoningMode) => void;
  onUpdateVoiceSettings: (patch: {
    voiceName?: ArixVoiceName;
    autoSpeak?: boolean;
  }) => Promise<void>;
  onSelectContext: (
    auditId: string | null,
    issueId: string | null,
    connectionId: string | null
  ) => void;
  onSendMessage: (
    message: string,
    attachments?: ChatAttachment[]
  ) => Promise<void>;
  onCancelSending?: () => void;
  onClearChat: () => Promise<void>;
  onGoToTeach: () => void;
}

function renderFormattedReply(content: string) {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const lang =
            firstNewline > 0 ? inner.slice(0, firstNewline).trim() : 'Code';
          const codeBody =
            firstNewline > 0 ? inner.slice(firstNewline + 1) : inner;
          return (
            <CodeBlock
              key={idx}
              label={lang || 'Code Output'}
              code={codeBody.trim()}
            />
          );
        }
        const paragraphs = seg
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        return paragraphs.map((p, pIdx) => (
          <p key={`${idx}-${pIdx}`} className="whitespace-pre-wrap">
            {p}
          </p>
        ));
      })}
    </div>
  );
}

export function AskArixWorkspace({
  messages,
  audits,
  connections,
  selectedAuditId,
  focusedIssueId,
  selectedConnectionId,
  sending,
  reasoningMode,
  voiceName,
  autoSpeak,
  activeRuleCount,
  draftPrompt,
  onConsumeDraftPrompt,
  onChangeReasoningMode,
  onUpdateVoiceSettings,
  onSelectContext,
  onSendMessage,
  onCancelSending,
  onClearChat,
  onGoToTeach,
}: AskArixWorkspaceProps) {
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<ChatAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<ChatAttachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
  const [expandedThoughts, setExpandedThoughts] = useState<
    Record<string, boolean>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<VoiceRecorderSession | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const voiceSupported = isVoiceRecordingSupported();

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
        const combined = input.trim()
          ? `${input.trim()} ${transcript}`
          : transcript;
        const imagesToSend = pendingImages;
        setInput('');
        setPendingImages([]);
        await onSendMessage(combined, imagesToSend);
      } else {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
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

  const handleCopyReply = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadReply = (msg: ChatMessage) => {
    const blob = new Blob([msg.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arix-reply-${msg.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (draftPrompt) {
      setInput(draftPrompt);
      onConsumeDraftPrompt?.();
    }
  }, [draftPrompt, onConsumeDraftPrompt]);

  useEffect(() => {
    return subscribeVoicePlayback(setVoiceState);
  }, []);

  useEffect(() => {
    return subscribeLiveCall(setLiveCall);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const activeAudit = audits.find((a) => a.id === selectedAuditId);
  const focusedIssue = activeAudit?.issues.find((i) => i.id === focusedIssueId);
  const activeConnection = connections.find(
    (c) => c.id === selectedConnectionId
  );

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

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
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

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files?.length) {
      await handleAttachFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || sending) return;
    const text = input.trim();
    const imagesToSend = pendingImages;
    setInput('');
    setPendingImages([]);
    await onSendMessage(text, imagesToSend);
  };

  const quickPrompts = focusedIssue
    ? [
        `Write the complete fixed code for "${focusedIssue.title}" using my preferred stack.`,
        `Explain why "${focusedIssue.title}" hurts user experience and how to verify the fix.`,
        `Teach Arix: Always rank issues like "${focusedIssue.title}" as P0 Critical.`,
      ]
    : activeConnection
      ? [
          `Inspect ${activeConnection.name} live and tell me what errors or improvements you see.`,
          `Write a production script or component integrating with ${activeConnection.name}.`,
          `Teach Arix: Remember that ${activeConnection.name} is my primary environment.`,
        ]
      : [
          'Create a 6-slide presentation on AI Automation with .pptx export.',
          'Create folder "projects/demo" and file "projects/demo/notes.txt" with my launch checklist.',
          'Find files matching "notes" and show me what is inside.',
          'Send a summary of my latest website audit or message to Telegram.',
        ];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragActive(false);
        }
      }}
      onDrop={handleDrop}
      className={`relative bg-[#0B152B] border rounded-xl flex flex-col h-[calc(100vh-11rem)] min-h-[540px] overflow-hidden transition-colors ${
        dragActive ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-slate-800/90'
      }`}
    >
      {/* Context Bar */}
      <div className="px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-[#081124]">
        <div className="flex flex-wrap items-center gap-3">
          <ArixAvatar size="sm" />
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-white">Arix Command Chat</span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={onGoToTeach}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              {activeRuleCount} active taught{' '}
              {activeRuleCount === 1 ? 'rule' : 'rules'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Arix response speed and reasoning depth"
            className="inline-flex items-center rounded-lg border border-slate-700 bg-[#060E1F] p-0.5"
          >
            {(
              [
                { id: 'fast', label: 'Fast', icon: Zap },
                { id: 'balanced', label: 'Balanced', icon: Sparkles },
                { id: 'deep', label: 'Deep', icon: Brain },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = reasoningMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeReasoningMode(opt.id)}
                  title={
                    opt.id === 'fast'
                      ? 'Fastest answers (lowest latency)'
                      : opt.id === 'balanced'
                        ? 'Smart coding & fast analysis (default)'
                        : 'Deep reasoning with step-by-step thinking'
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-[#060E1F] p-0.5 gap-0.5">
            <select
              aria-label="Select Arix voice"
              value={voiceName}
              onChange={(e) =>
                void onUpdateVoiceSettings({
                  voiceName: e.target.value as ArixVoiceName,
                })
              }
              title="Choose Arix voice"
              className="px-2 py-1 text-xs bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              {ARIX_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#081124]">
                  {v.label} — {v.tagline}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void previewArixVoice(voiceName)}
              title="Preview selected voice"
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                voiceState.playingId === `preview-${voiceName}` ||
                voiceState.loadingId === `preview-${voiceName}`
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {voiceState.loadingId === `preview-${voiceName}` ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : voiceState.playingId === `preview-${voiceName}` ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>
                {voiceState.playingId === `preview-${voiceName}`
                  ? 'Stop'
                  : 'Test'}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                void onUpdateVoiceSettings({ autoSpeak: !autoSpeak })
              }
              title={
                autoSpeak
                  ? 'Auto-Speak ON: Arix reads new replies aloud'
                  : 'Auto-Speak OFF: Click Listen on replies to hear Arix'
              }
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                autoSpeak
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {autoSpeak ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{autoSpeak ? 'Auto' : 'Manual'}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              liveCall.status === 'live' || liveCall.status === 'connecting'
                ? stopLiveCall()
                : void startLiveCall(voiceName)
            }
            title="Start or end a real-time two-way voice call with Arix"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              liveCall.status === 'live' || liveCall.status === 'connecting'
                ? 'bg-red-500/20 border-red-500/60 text-red-200 hover:bg-red-500/30'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
            }`}
          >
            {liveCall.status === 'connecting' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : liveCall.status === 'live' ? (
              <PhoneOff className="w-3.5 h-3.5" />
            ) : (
              <Phone className="w-3.5 h-3.5" />
            )}
            <span>
              {liveCall.status === 'connecting'
                ? 'Connecting...'
                : liveCall.status === 'live'
                  ? 'End Call'
                  : 'Live Call'}
            </span>
          </button>
          {connections.length > 0 && (
            <select
              aria-label="Attach connected platform"
              value={selectedConnectionId || ''}
              onChange={(e) =>
                onSelectContext(
                  selectedAuditId,
                  focusedIssueId,
                  e.target.value || null
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[190px] truncate"
            >
              <option value="">No connected site pinned</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type.toUpperCase()}: {c.name}
                </option>
              ))}
            </select>
          )}

          {audits.length > 0 && (
            <select
              aria-label="Select website audit context"
              value={selectedAuditId || ''}
              onChange={(e) =>
                onSelectContext(
                  e.target.value || null,
                  null,
                  selectedConnectionId
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[190px] truncate"
            >
              <option value="">No audit pinned</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.targetLabel}
                </option>
              ))}
            </select>
          )}

          {activeAudit && activeAudit.issues.length > 0 && (
            <select
              aria-label="Focus on specific UX issue"
              value={focusedIssueId || ''}
              onChange={(e) =>
                onSelectContext(
                  activeAudit.id,
                  e.target.value || null,
                  selectedConnectionId
                )
              }
              className="px-2.5 py-1.5 text-xs bg-[#060E1F] border border-slate-700 text-slate-200 rounded-lg max-w-[210px] truncate"
            >
              <option value="">All issues in report</option>
              {activeAudit.issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.priority} · {issue.title}
                </option>
              ))}
            </select>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 bg-[#060E1F] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {voiceState.error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-500/30 text-xs text-red-300 flex items-center justify-between gap-2">
          <span>Voice playback: {voiceState.error}</span>
        </div>
      )}

      {liveCall.status !== 'idle' && (
        <div
          className={`px-6 py-3 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
            liveCall.status === 'error'
              ? 'bg-red-950/40 border-red-500/30 text-red-200'
              : 'bg-[#07162B] border-emerald-500/30 text-slate-200'
          }`}
        >
          <div className="space-y-1 min-w-0 flex-1">
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
                    ? `Live Call Error: ${liveCall.error}`
                    : `Live Voice Call Active · ${voiceName} (speak anytime, interrupt naturally)`}
              </span>
            </div>
            {(liveCall.userTranscript || liveCall.arixTranscript) && (
              <div className="text-[11px] text-slate-300 space-y-0.5 truncate">
                {liveCall.userTranscript && (
                  <div className="truncate">
                    <span className="text-sky-300 font-semibold">You:</span>{' '}
                    {liveCall.userTranscript}
                  </div>
                )}
                {liveCall.arixTranscript && (
                  <div className="truncate">
                    <span className="text-emerald-300 font-semibold">Arix:</span>{' '}
                    {liveCall.arixTranscript.slice(-180)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {liveCall.status === 'live' && (
              <button
                type="button"
                onClick={toggleLiveCallMute}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                  liveCall.muted
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                    : 'bg-[#060E1F] border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                {liveCall.muted ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span>{liveCall.muted ? 'Muted' : 'Mute'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={stopLiveCall}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 text-xs font-medium cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{liveCall.status === 'error' ? 'Close' : 'End Call'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 space-y-6">
            <div className="flex items-start gap-4">
              <ArixAvatar size="lg" />
              <div>
                <h2 className="text-lg font-display font-semibold text-white">
                  Arix is ready. Command me or teach me anything.
                </h2>
                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Ask me to write code, debug errors, inspect your connected
                  GitHub repositories, check Cloudflare DNS/headers, analyze
                  websites, or type any rule you want me to learn permanently.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">
                Suggested owner commands
              </p>
              <div className="grid grid-cols-1 gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendMessage(prompt)}
                    disabled={sending}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 bg-[#081124] hover:bg-slate-800/70 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'arix' && <ArixAvatar size="sm" className="mt-1" />}
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-sky-500 text-slate-950 font-medium'
                      : 'bg-[#081124] border border-slate-800 text-slate-100'
                  }`}
                >
                  {msg.issueTitle && (
                    <div
                      className={`text-xs mb-1.5 ${
                        msg.role === 'user' ? 'text-slate-900/70' : 'text-slate-400'
                      }`}
                    >
                      Context: {msg.issueTitle}
                    </div>
                  )}

                  {msg.role === 'arix' && msg.thinkingSummary && (
                    <div className="mb-3 rounded-lg border border-sky-500/20 bg-[#060E1F]/80">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedThoughts((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-sky-400" />
                          <span>Arix Thinking Process</span>
                        </span>
                        {expandedThoughts[msg.id] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                      {expandedThoughts[msg.id] && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                          {msg.thinkingSummary}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att) =>
                        att.dataUrl &&
                        (att.kind === 'image' ||
                          att.mimeType.startsWith('image/')) ? (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => setPreviewImage(att)}
                            className="group relative rounded-lg overflow-hidden border border-slate-950/20 bg-black/20 cursor-pointer"
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="max-h-44 max-w-[240px] object-cover block"
                            />
                          </button>
                        ) : (
                          <div
                            key={att.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${
                              msg.role === 'user'
                                ? 'bg-slate-950/15 border-slate-950/20 text-slate-950'
                                : 'bg-[#060E1F] border-slate-700 text-slate-200'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="max-w-[180px] truncate">
                              {att.name}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    renderFormattedReply(msg.content)
                  )}

                  {msg.role === 'arix' &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/90 space-y-1.5">
                        <div className="text-[11px] font-medium text-slate-400">
                          Web Sources
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src) => (
                            <a
                              key={src.url}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#060E1F] border border-slate-700/80 hover:border-sky-500/60 text-xs text-sky-300 max-w-[240px]"
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                  {msg.toolsInvoked && msg.toolsInvoked.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/90 flex flex-wrap items-center gap-2 text-xs text-sky-400">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span>Tools used: {msg.toolsInvoked.join(' · ')}</span>
                    </div>
                  )}

                  {msg.newlyLearnedRules && msg.newlyLearnedRules.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/90 space-y-1">
                      {msg.newlyLearnedRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Learned &amp; saved rule: &ldquo;{rule.title}&rdquo;
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'arix' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void playArixSpeech({
                            id: msg.id,
                            text: msg.content,
                            voiceName,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border cursor-pointer ${
                          voiceState.playingId === msg.id ||
                          voiceState.loadingId === msg.id
                            ? 'text-sky-300 border-sky-500/60 bg-sky-500/10'
                            : 'text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {voiceState.loadingId === msg.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : voiceState.playingId === msg.id ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Listen ({voiceName})</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyReply(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 rounded border border-slate-800 hover:border-slate-700 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadReply(msg)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 rounded border border-slate-800 hover:border-slate-700 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>.md</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-start gap-3.5">
                <ArixAvatar size="sm" className="mt-1" />
                <div className="bg-[#081124] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 flex items-center gap-3">
                  <span>Arix is thinking &amp; analyzing...</span>
                  {onCancelSending && (
                    <button
                      type="button"
                      onClick={onCancelSending}
                      className="px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/40 rounded-md hover:bg-amber-950/40 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-800 bg-[#081124]"
      >
        <div className="max-w-3xl mx-auto space-y-2.5">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              {pendingImages.map((att) => (
                <div
                  key={att.id}
                  className="relative group rounded-lg overflow-hidden border border-slate-700 bg-[#060E1F]"
                >
                  {att.dataUrl &&
                  (att.kind === 'image' || att.mimeType.startsWith('image/')) ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-16 w-16 object-cover block"
                    />
                  ) : (
                    <div className="h-16 px-3 pr-7 flex items-center gap-2 text-xs text-slate-200 max-w-[190px]">
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
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-950/85 text-slate-200 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <span className="text-xs text-slate-400">
                {pendingImages.length}/4 file{pendingImages.length > 1 ? 's' : ''} attached
              </span>
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

          <div className="flex items-end gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.sql,.log,.yml,.yaml,.xml"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || pendingImages.length >= 4}
              title="Attach image, PDF, or code/text file (or Ctrl+V / drag & drop)"
              aria-label="Attach image, PDF, or file"
              className="inline-flex items-center justify-center px-3 bg-[#060E1F] border border-slate-700 text-slate-200 hover:text-sky-300 hover:border-sky-500/60 disabled:opacity-40 rounded-lg transition-colors shrink-0 cursor-pointer h-[44px]"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={sending || transcribingVoice}
                title={
                  listening
                    ? 'Stop & send voice command'
                    : 'Give a command by voice'
                }
                aria-label={
                  listening ? 'Stop and send voice command' : 'Speak voice command'
                }
                className={`inline-flex items-center justify-center px-3 border rounded-lg transition-colors shrink-0 cursor-pointer h-[44px] ${
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

            <div className="flex-1">
              <label htmlFor="ask-arix-input" className="sr-only">
                Command Arix or teach a new rule
              </label>
              <textarea
                id="ask-arix-input"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask Arix anything, paste a screenshot (Ctrl+V), attach code/PDF/image, or run commands..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#060E1F] border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 resize-none"
              />
            </div>

            {sending && onCancelSending ? (
              <button
                type="button"
                onClick={onCancelSending}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer h-[44px]"
              >
                <span>Cancel</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && pendingImages.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-slate-950 text-sm font-semibold rounded-lg hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer h-[44px]"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {dragActive && (
        <div className="pointer-events-none absolute inset-0 bg-sky-950/75 border-2 border-dashed border-sky-400 rounded-xl flex items-center justify-center z-20">
          <div className="text-center space-y-1">
            <Paperclip className="w-8 h-8 text-sky-300 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Drop image, PDF, or code files to send to Arix
            </p>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-[#081124] border border-slate-700 rounded-xl p-3"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900/90 text-slate-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage.dataUrl}
              alt={previewImage.name}
              className="max-h-[82vh] max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
