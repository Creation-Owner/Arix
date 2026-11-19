import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  CalendarClock,
  Clock,
  FolderOpen,
  HardDrive,
  Home,
  Link2,
  Menu,
  MessageSquare,
  MonitorDown,
  SearchCode,
  Sparkles,
  X,
} from 'lucide-react';
import { AnalyzeWorkspace } from './components/AnalyzeWorkspace';
import { ArixAvatar } from './components/ArixAvatar';
import { AskArixWorkspace } from './components/AskArixWorkspace';
import { ComputerWorkspace } from './components/ComputerWorkspace';
import { ConnectionsWorkspace } from './components/ConnectionsWorkspace';
import { DesktopAppModal } from './components/DesktopAppModal';
import { HistoryWorkspace } from './components/HistoryWorkspace';
import { MainPage } from './components/MainPage';
import {
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallButton';
import { OfflineBrainWorkspace } from './components/OfflineBrainWorkspace';
import { SchedulesWorkspace } from './components/SchedulesWorkspace';
import { SelfSectionFrame } from './components/SelfSectionFrame';
import { TeachArixWorkspace } from './components/TeachArixWorkspace';
import { WidgetWorkspace } from './components/WidgetWorkspace';
import type {
  ArixActivityEvent,
  ArixLiveStatus,
  ArixSatelliteKey,
  ArixStatePayload,
  ArixVoiceName,
  BrainEngineMode,
  BrainSettings,
  ChatAttachment,
  ChatMessage,
  ConnectedSite,
  ConnectedSiteType,
  CustomSection,
  KnowledgeNote,
  KnowledgeNoteCategory,
  LocalLlmStatus,
  PersonaSettings,
  ReasoningMode,
  RuleCategory,
  RuleWeight,
  ScheduledTask,
  ScheduledTaskAction,
  TaughtRule,
  WebsiteAudit,
  WebsiteWidgetSettings,
} from './types/arix';
import { playArixSpeech } from './utils/voicePlayer';

type BuiltInTab =
  | 'home'
  | 'brain'
  | 'connections'
  | 'widget'
  | 'computer'
  | 'analyze'
  | 'ask'
  | 'teach'
  | 'schedules'
  | 'history';

type WorkspaceTab = BuiltInTab | `section:${string}`;

const TAB_META: Record<BuiltInTab, { label: string }> = {
  home: { label: 'Main Page' },
  brain: { label: 'Offline Brain' },
  connections: { label: 'Connect Sites' },
  widget: { label: 'Website Widget' },
  computer: { label: 'Computer Files' },
  analyze: { label: 'Analyze Website' },
  ask: { label: 'Command Chat' },
  teach: { label: 'Teach Arix' },
  schedules: { label: 'Schedules' },
  history: { label: 'Audit History' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loadingState, setLoadingState] = useState(true);
  const [stateError, setStateError] = useState<string | null>(null);

  const [rules, setRules] = useState<TaughtRule[]>([]);
  const [connections, setConnections] = useState<ConnectedSite[]>([]);
  const [computerRoot, setComputerRoot] = useState<string>('');
  const [persona, setPersona] = useState<PersonaSettings>({
    ownerName: 'Owner',
    primaryGoal: '',
    techStack: '',
    codingStyle: '',
    tonePreference: '',
    customDirective: '',
    voiceName: 'Kore',
    autoSpeak: false,
  });
  const [audits, setAudits] = useState<WebsiteAudit[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [widgetSettings, setWidgetSettings] = useState<WebsiteWidgetSettings>({
    enabled: true,
    assistantName: 'Arix Assistant',
    tagline: 'AI Website Assistant',
    welcomeMessage: 'Hi! Ask me anything about our website, products, or support.',
    placeholder: 'Ask a question...',
    accentColor: '#38BDF8',
    position: 'bottom-right',
    allowedOrigins: '*',
    siteKnowledge: '',
    publicKey: '',
    requirePublicKey: false,
  });
  const [knowledgeNotes, setKnowledgeNotes] = useState<KnowledgeNote[]>([]);
  const [brainSettings, setBrainSettings] = useState<BrainSettings>({
    mode: 'auto',
    localLlmUrl: 'http://127.0.0.1:11434',
    localLlmModel: '',
    autoIndexChat: true,
  });

  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null
  );
  const [draftChatPrompt, setDraftChatPrompt] = useState<string | null>(null);
  const [desktopModalOpen, setDesktopModalOpen] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>('balanced');
  const chatAbortRef = useRef<AbortController | null>(null);
  const [liveStatus, setLiveStatus] = useState<ArixLiveStatus>(() => ({
    busy: false,
    activeNode: 'core',
    headline: 'Arix Core · Ready',
    detail: 'Standing by for your next command',
    nodeStatuses: {
      core: { state: 'idle', label: 'Ready' },
      text: { state: 'idle', label: 'Memory · Audits' },
      compute: { state: 'idle', label: 'Files · Cloudflare' },
      code: { state: 'idle', label: 'GitHub · Websites' },
      network: { state: 'idle', label: 'Telegram Bot' },
    },
    events: [],
  }));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Failed to load Arix workspace state.');
        const data = (await res.json()) as ArixStatePayload;
        if (!active) return;
        setRules(data.rules);
        setPersona(data.persona);
        setConnections(data.connections || []);
        setAudits(data.audits);
        setChatHistory(data.chatHistory);
        setCustomSections(data.customSections || []);
        setScheduledTasks(data.scheduledTasks || []);
        if (data.widgetSettings) setWidgetSettings(data.widgetSettings);
        setKnowledgeNotes(data.knowledgeNotes || []);
        if (data.brainSettings) setBrainSettings(data.brainSettings);
        setComputerRoot(data.computerRoot || '');
        if (data.audits.length > 0) {
          setSelectedAuditId(data.audits[0].id);
        }
      } catch (err) {
        if (!active) return;
        setStateError(
          err instanceof Error ? err.message : 'Unable to reach Arix server.'
        );
      } finally {
        if (active) setLoadingState(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const applyActivityEvent = (ev: ArixActivityEvent) => {
      setLiveStatus((prev) => {
        const nextNodes = { ...prev.nodeStatuses };
        const busyNow =
          ev.phase === 'thinking' || ev.phase === 'tool_start';

        if (ev.phase === 'thinking') {
          (['text', 'compute', 'code', 'network'] as ArixSatelliteKey[]).forEach(
            (k) => {
              nextNodes[k] = {
                state: 'idle',
                label:
                  k === 'text'
                    ? 'Memory · Audits'
                    : k === 'compute'
                      ? 'Files · Cloudflare'
                      : k === 'code'
                        ? 'GitHub · Websites'
                        : 'Telegram Bot',
              };
            }
          );
          nextNodes.core = { state: 'working', label: ev.title };
        } else if (ev.phase === 'tool_start') {
          nextNodes[ev.node] = {
            state: 'working',
            label: ev.detail || ev.title,
          };
          nextNodes.core = { state: 'working', label: ev.title };
        } else if (ev.phase === 'tool_done') {
          nextNodes[ev.node] = {
            state: 'done',
            label: ev.detail || ev.title,
          };
        } else if (ev.phase === 'done') {
          nextNodes[ev.node] = {
            state: 'done',
            label: ev.title,
          };
          nextNodes.core = { state: 'done', label: 'Completed' };
        } else if (ev.phase === 'error') {
          nextNodes[ev.node] = {
            state: 'error',
            label: ev.detail || ev.title,
          };
          nextNodes.core = { state: 'error', label: ev.title };
        }

        const mergedEvents = [...prev.events, ev].slice(-20);
        return {
          busy: busyNow,
          activeNode: ev.node,
          headline: ev.title,
          detail: ev.detail,
          nodeStatuses: nextNodes,
          events: mergedEvents,
        };
      });
    };

    const source = new EventSource('/api/activity/stream');
    source.addEventListener('snapshot', (e) => {
      try {
        const list = JSON.parse((e as MessageEvent).data) as ArixActivityEvent[];
        if (Array.isArray(list) && list.length > 0) {
          for (const ev of list) {
            applyActivityEvent(ev);
          }
        }
      } catch {
        // Ignore snapshot parse error
      }
    });
    source.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as ArixActivityEvent;
        if (ev && ev.phase) {
          applyActivityEvent(ev);
        }
      } catch {
        // Ignore malformed event
      }
    };
    return () => {
      source.close();
    };
  }, []);

  const activeAudit =
    audits.find((a) => a.id === selectedAuditId) || audits[0] || null;
  const activeRules = rules.filter((r) => r.active);

  const handleRunAnalysis = async (payload: {
    inputType: 'url' | 'code' | 'screenshot';
    url?: string;
    code?: string;
    notes?: string;
    screenshotBase64?: string;
    screenshotMimeType?: string;
    connectionId?: string;
  }) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          clientOffline:
            typeof navigator !== 'undefined' && navigator.onLine === false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }
      const created = data as WebsiteAudit;
      setAudits((prev) => [created, ...prev]);
      setSelectedAuditId(created.id);
      setFocusedIssueId(created.issues[0]?.id || null);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Website analysis failed.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleIssueStatus = async (
    auditId: string,
    issueId: string,
    status: 'open' | 'resolved'
  ) => {
    const res = await fetch(`/api/audits/${auditId}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const updatedAudit = (await res.json()) as WebsiteAudit;
    setAudits((prev) =>
      prev.map((a) => (a.id === auditId ? updatedAudit : a))
    );
  };

  const handleDeleteAudit = async (auditId: string) => {
    const res = await fetch(`/api/audits/${auditId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setAudits((prev) => {
      const next = prev.filter((a) => a.id !== auditId);
      if (selectedAuditId === auditId) {
        setSelectedAuditId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleAddRule = async (input: {
    title: string;
    instruction: string;
    category: RuleCategory;
    weight: RuleWeight;
  }) => {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return;
    const created = (await res.json()) as TaughtRule;
    setRules((prev) => [created, ...prev]);
  };

  const handleUpdateRule = async (
    id: string,
    patch: Partial<Omit<TaughtRule, 'id' | 'createdAt'>>
  ) => {
    const res = await fetch(`/api/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as TaughtRule;
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const handleDeleteRule = async (id: string) => {
    const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleResetRulesToZero = async () => {
    const res = await fetch('/api/rules/reset', { method: 'POST' });
    if (!res.ok) return;
    setRules([]);
  };

  const handleSavePersona = async (nextPersona: PersonaSettings) => {
    const res = await fetch('/api/persona', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextPersona),
    });
    if (!res.ok) return;
    const saved = (await res.json()) as PersonaSettings;
    setPersona(saved);
  };

  const handleUpdateVoiceSettings = async (patch: {
    voiceName?: ArixVoiceName;
    autoSpeak?: boolean;
  }) => {
    const nextPersona: PersonaSettings = { ...persona, ...patch };
    setPersona(nextPersona);
    const res = await fetch('/api/persona', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const saved = (await res.json()) as PersonaSettings;
      setPersona(saved);
    }
  };

  const handleUpdateComputerRoot = async (rootPath: string) => {
    const res = await fetch('/api/computer/root', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to set root path.');
    setComputerRoot(data.computerRoot);
  };

  const handleExportBrain = async () => {
    const res = await fetch('/api/brain/export');
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arix-brain-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBrain = async (jsonPayload: unknown): Promise<number> => {
    const res = await fetch('/api/brain/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonPayload),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as {
      importedRules: number;
      state: ArixStatePayload;
    };
    setRules(data.state.rules);
    setPersona(data.state.persona);
    if (Array.isArray(data.state.customSections)) {
      setCustomSections(data.state.customSections);
    }
    return data.importedRules;
  };

  const handleAddConnection = async (payload: {
    name: string;
    type: ConnectedSiteType;
    targetUrl: string;
    identifier: string;
    token?: string;
  }) => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add connection.');
    setConnections((prev) => [data as ConnectedSite, ...prev]);
  };

  const handleSyncConnection = async (id: string) => {
    const res = await fetch(`/api/connections/${id}/sync`, { method: 'POST' });
    if (!res.ok) return;
    const updated = (await res.json()) as ConnectedSite;
    setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleUpdateConnection = async (
    id: string,
    patch: { identifier?: string; targetUrl?: string; token?: string }
  ) => {
    const res = await fetch(`/api/connections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update connection.');
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? (data as ConnectedSite) : c))
    );
  };

  const handleToggleConnection = async (id: string, active: boolean) => {
    const res = await fetch(`/api/connections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as ConnectedSite;
    setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleDeleteConnection = async (id: string) => {
    const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    if (selectedConnectionId === id) setSelectedConnectionId(null);
  };

  const handleDeleteSection = async (id: string) => {
    const res = await fetch(`/api/sections/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setCustomSections((prev) => prev.filter((s) => s.id !== id));
    if (activeTab === `section:${id}`) {
      setActiveTab('home');
    }
  };

  const handleAskArixToModifySection = (section: CustomSection) => {
    setDraftChatPrompt(
      `Update my self-built section "${section.title}" (ID: ${section.id}): `
    );
    switchTab('ask');
  };

  const handleSendTelegramTest = async (
    connectionId: string,
    message: string
  ) => {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Telegram send failed.');
  };

  const handleCancelChat = () => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setSendingChat(false);
    setLiveStatus((prev) => ({
      ...prev,
      busy: false,
      activeNode: 'core',
      headline: 'Arix Core · Ready',
      detail: 'Command cancelled',
    }));
  };

  const handleSendChat = async (
    message: string,
    attachments?: ChatAttachment[],
    modeOverride?: ReasoningMode
  ) => {
    if (sendingChat) return;
    const cleanText = message.trim();
    const validAttachments = Array.isArray(attachments) ? attachments : [];
    if (!cleanText && validAttachments.length === 0) return;

    const activeMode = modeOverride || reasoningMode;
    const tempUserId = `temp-u-${Date.now()}`;
    const optimisticUserMsg: ChatMessage = {
      id: tempUserId,
      role: 'user',
      content:
        cleanText ||
        `Sent ${validAttachments.length} image${validAttachments.length > 1 ? 's' : ''}`,
      attachments: validAttachments.length > 0 ? validAttachments : undefined,
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, optimisticUserMsg]);
    setSendingChat(true);
    setLiveStatus((prev) => ({
      ...prev,
      busy: true,
      activeNode: 'core',
      headline:
        activeMode === 'fast'
          ? 'Arix Core · Fast Reply'
          : activeMode === 'deep'
            ? 'Arix Core · Deep Reasoning'
            : 'Arix Core · Thinking',
      detail: (cleanText || 'Analyzing image...').slice(0, 90),
    }));

    const controller = new AbortController();
    chatAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: cleanText,
          attachments: validAttachments,
          reasoningMode: activeMode,
          brainMode: brainSettings.mode,
          clientOffline:
            typeof navigator !== 'undefined' && navigator.onLine === false,
          auditId: selectedAuditId,
          issueId: focusedIssueId,
          connectionId: selectedConnectionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed.');
      }
      setChatHistory((prev) => [
        ...prev.filter((m) => m.id !== tempUserId),
        data.userMessage as ChatMessage,
        data.arixMessage as ChatMessage,
      ]);
      const reply = data.arixMessage as ChatMessage | undefined;
      if (persona.autoSpeak && reply?.content) {
        void playArixSpeech({
          id: reply.id,
          text: reply.content,
          voiceName: persona.voiceName || 'Kore',
        });
      }
      if (
        Array.isArray(data.newlyLearnedRules) &&
        data.newlyLearnedRules.length > 0
      ) {
        setRules((prev) => [...data.newlyLearnedRules, ...prev]);
      }
      if (Array.isArray(data.customSections)) {
        setCustomSections(data.customSections as CustomSection[]);
      }
      if (Array.isArray(data.scheduledTasks)) {
        setScheduledTasks(data.scheduledTasks as ScheduledTask[]);
      }
      if (Array.isArray(data.knowledgeNotes)) {
        setKnowledgeNotes(data.knowledgeNotes as KnowledgeNote[]);
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const msg = isAbort
        ? 'Request timed out or was cancelled.'
        : err instanceof Error
          ? err.message
          : 'Unable to reach Arix right now.';
      setChatHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'arix',
          content: `I hit an issue executing that: ${msg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      chatAbortRef.current = null;
      setSendingChat(false);
    }
  };

  const handleClearChat = async () => {
    await fetch('/api/chat', { method: 'DELETE' });
    setChatHistory([]);
  };

  const handleCreateSchedule = async (payload: {
    title: string;
    actionType: ScheduledTaskAction;
    intervalMinutes: number;
    promptOrMessage: string;
    targetUrl?: string;
    telegramConnectionId?: string;
  }) => {
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create schedule.');
    setScheduledTasks((prev) => [data as ScheduledTask, ...prev]);
  };

  const handleToggleSchedule = async (id: string, active: boolean) => {
    const res = await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as ScheduledTask;
    setScheduledTasks((prev) =>
      prev.map((t) => (t.id === id ? updated : t))
    );
  };

  const handleRunScheduleNow = async (id: string) => {
    const res = await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to run schedule.');
    const updated = data as ScheduledTask;
    setScheduledTasks((prev) =>
      prev.map((t) => (t.id === id ? updated : t))
    );
  };

  const handleDeleteSchedule = async (id: string) => {
    const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setScheduledTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveWidgetSettings = async (
    patch: Partial<WebsiteWidgetSettings>
  ) => {
    const res = await fetch('/api/widget', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save widget settings.');
    setWidgetSettings(data as WebsiteWidgetSettings);
  };

  const handleRegenerateWidgetKey = async () => {
    const res = await fetch('/api/widget/regenerate-key', { method: 'POST' });
    if (!res.ok) return;
    const data = (await res.json()) as WebsiteWidgetSettings;
    setWidgetSettings(data);
  };

  const handleSaveBrainSettings = async (
    patch: Partial<BrainSettings>
  ): Promise<{ settings: BrainSettings; localLlm: LocalLlmStatus }> => {
    const res = await fetch('/api/brain/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save brain settings.');
    setBrainSettings(data.settings as BrainSettings);
    return data as { settings: BrainSettings; localLlm: LocalLlmStatus };
  };

  const handleChangeBrainMode = async (mode: BrainEngineMode) => {
    await handleSaveBrainSettings({ mode });
  };

  const handleAddKnowledgeNote = async (input: {
    title?: string;
    content?: string;
    category: KnowledgeNoteCategory;
    tags: string[];
    localFilePath?: string;
    source?: 'manual' | 'file_import';
  }) => {
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save knowledge note.');
    setKnowledgeNotes((prev) => [data as KnowledgeNote, ...prev]);
  };

  const handleDeleteKnowledgeNote = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setKnowledgeNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const navItems: Array<{
    id: BuiltInTab;
    label: string;
    icon: typeof Home;
    count?: number;
  }> = [
    { id: 'home', label: 'Main Page', icon: Home },
    {
      id: 'brain',
      label: 'Offline Brain',
      icon: HardDrive,
      count: knowledgeNotes.length,
    },
    {
      id: 'connections',
      label: 'Connect Sites',
      icon: Link2,
      count: connections.length,
    },
    { id: 'widget', label: 'Website Widget', icon: Bot },
    { id: 'computer', label: 'Computer Files', icon: FolderOpen },
    { id: 'analyze', label: 'Analyze Website', icon: SearchCode },
    { id: 'ask', label: 'Command Chat', icon: MessageSquare },
    {
      id: 'teach',
      label: 'Teach Arix',
      icon: BookOpen,
      count: activeRules.length,
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: CalendarClock,
      count: scheduledTasks.filter((t) => t.active).length,
    },
    {
      id: 'history',
      label: 'Audit History',
      icon: Clock,
      count: audits.length,
    },
  ];

  const sidebarSections = customSections.filter(
    (s) => s.placement !== 'main_page'
  );

  const activeCustomSection = activeTab.startsWith('section:')
    ? customSections.find((s) => `section:${s.id}` === activeTab) || null
    : null;

  const activeHeaderLabel = activeCustomSection
    ? activeCustomSection.title
    : TAB_META[activeTab as BuiltInTab]?.label || 'Main Page';

  const switchTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#060E1F] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#081124] border-r border-slate-800/90 sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-800/90 flex items-center gap-3">
          <ArixAvatar size="md" />
          <div className="min-w-0">
            <div className="font-display font-bold text-base text-white truncate">
              Arix
            </div>
            <div className="text-xs text-slate-400 truncate">
              Personal Autonomous AI
            </div>
          </div>
        </div>

        <nav
          className="flex-1 p-3 space-y-1 overflow-y-auto"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-slate-900/80' : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {sidebarSections.length > 0 && (
            <div className="pt-4 mt-3 border-t border-slate-800/80 space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Self-Built Sections
              </div>
              {sidebarSections.map((sec) => {
                const tabId: WorkspaceTab = `section:${sec.id}`;
                const isActive = activeTab === tabId;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => switchTab(tabId)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
                    <span className="truncate">
                      {sec.navLabel || sec.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800/90 text-xs text-slate-400 space-y-2.5">
          <div>
            <div className="font-medium text-slate-200">Local Desktop Brain</div>
            <div className="tabular-nums mt-0.5">
              {activeRules.length} rules · {connections.length} connected ·{' '}
              {customSections.length} sections
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDesktopModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
          >
            <MonitorDown className="w-3.5 h-3.5 text-sky-400" />
            <span>Desktop App &amp; VS Code</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-[#081124] h-full border-r border-slate-800 flex flex-col z-10">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArixAvatar size="sm" />
                <span className="font-display font-bold text-white">Arix</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-400 hover:text-white rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.count !== undefined && (
                      <span className="text-xs font-mono tabular-nums">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}

              {sidebarSections.length > 0 && (
                <div className="pt-3 mt-2 border-t border-slate-800 space-y-1">
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Self-Built Sections
                  </div>
                  {sidebarSections.map((sec) => {
                    const tabId: WorkspaceTab = `section:${sec.id}`;
                    const isActive = activeTab === tabId;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => switchTab(tabId)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
                        <span className="truncate">
                          {sec.navLabel || sec.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-[#081124]/95 backdrop-blur border-b border-slate-800/90 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Arix Workspace</span>
                <span aria-hidden="true">/</span>
                <span className="text-sky-300 font-medium truncate">
                  {activeHeaderLabel}
                </span>
              </div>
              <h1 className="text-lg font-display font-semibold text-white truncate">
                {activeHeaderLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {liveStatus.busy && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#060E1F] border border-cyan-500/50 text-xs text-cyan-200 max-w-[240px]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0" />
                <span className="truncate font-mono">{liveStatus.headline}</span>
              </div>
            )}
            <PWAInstallButton
              onOpenDesktopGuide={() => setDesktopModalOpen(true)}
            />
            {activeTab === 'ask' ? (
              <button
                type="button"
                onClick={() => switchTab('teach')}
                className="px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Teach Arix
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchTab('ask')}
                className="px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Command Arix
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto">
          {loadingState ? (
            <div className="bg-[#0B152B] border border-slate-800 rounded-xl p-8 animate-pulse space-y-4">
              <div className="h-5 w-48 bg-slate-800 rounded" />
              <div className="h-24 w-full bg-slate-800/60 rounded-lg" />
            </div>
          ) : stateError ? (
            <div className="bg-[#0B152B] border border-red-500/30 rounded-xl p-6 text-sm text-red-300">
              {stateError}
            </div>
          ) : (
            <>
              {activeTab === 'home' && (
                <MainPage
                  connectedCount={connections.length}
                  activeRuleCount={activeRules.length}
                  auditCount={audits.length}
                  chatCount={chatHistory.length}
                  ownerName={persona.ownerName}
                  voiceName={persona.voiceName || 'Kore'}
                  liveStatus={liveStatus}
                  sendingCommand={sendingChat}
                  latestArixReply={
                    [...chatHistory].reverse().find((m) => m.role === 'arix') ||
                    null
                  }
                  customSections={customSections}
                  onSendCommand={handleSendChat}
                  onChangeVoice={(voiceName) =>
                    handleUpdateVoiceSettings({ voiceName })
                  }
                  onDeleteSection={handleDeleteSection}
                  onAskArixToModifySection={handleAskArixToModifySection}
                  onOpenDesktopAppModal={() => setDesktopModalOpen(true)}
                  onNavigate={(tab) => switchTab(tab)}
                />
              )}

              {activeTab === 'brain' && (
                <OfflineBrainWorkspace
                  brainSettings={brainSettings}
                  knowledgeNotes={knowledgeNotes}
                  activeRuleCount={activeRules.length}
                  auditCount={audits.length}
                  chatCount={chatHistory.length}
                  onSaveBrainSettings={handleSaveBrainSettings}
                  onAddKnowledgeNote={handleAddKnowledgeNote}
                  onDeleteKnowledgeNote={handleDeleteKnowledgeNote}
                />
              )}

              {activeTab === 'connections' && (
                <ConnectionsWorkspace
                  connections={connections}
                  onAddConnection={handleAddConnection}
                  onSyncConnection={handleSyncConnection}
                  onUpdateConnection={handleUpdateConnection}
                  onToggleConnection={handleToggleConnection}
                  onDeleteConnection={handleDeleteConnection}
                  onSendTelegramTest={handleSendTelegramTest}
                  onAnalyzeConnection={(conn) => {
                    setSelectedConnectionId(conn.id);
                    switchTab('analyze');
                  }}
                  onChatWithConnection={(conn) => {
                    setSelectedConnectionId(conn.id);
                    switchTab('ask');
                  }}
                />
              )}

              {activeTab === 'widget' && (
                <WidgetWorkspace
                  settings={widgetSettings}
                  connections={connections}
                  onSaveSettings={handleSaveWidgetSettings}
                  onRegenerateKey={handleRegenerateWidgetKey}
                />
              )}

              {activeTab === 'computer' && (
                <ComputerWorkspace
                  computerRoot={computerRoot}
                  onUpdateRoot={handleUpdateComputerRoot}
                />
              )}

              {activeTab === 'analyze' && (
                <AnalyzeWorkspace
                  activeAudit={activeAudit}
                  analyzing={analyzing}
                  error={analyzeError}
                  activeRules={activeRules}
                  connections={connections}
                  preselectedConnectionId={selectedConnectionId}
                  persona={persona}
                  onRunAnalysis={handleRunAnalysis}
                  onToggleIssueStatus={handleToggleIssueStatus}
                  onAskAboutIssue={(auditId, issueId) => {
                    setSelectedAuditId(auditId);
                    setFocusedIssueId(issueId);
                    switchTab('ask');
                  }}
                  onGoToTeach={() => switchTab('teach')}
                />
              )}

              {activeTab === 'ask' && (
                <AskArixWorkspace
                  messages={chatHistory}
                  audits={audits}
                  connections={connections}
                  selectedAuditId={selectedAuditId}
                  focusedIssueId={focusedIssueId}
                  selectedConnectionId={selectedConnectionId}
                  sending={sendingChat}
                  reasoningMode={reasoningMode}
                  brainMode={brainSettings.mode}
                  voiceName={persona.voiceName || 'Kore'}
                  autoSpeak={Boolean(persona.autoSpeak)}
                  activeRuleCount={activeRules.length}
                  draftPrompt={draftChatPrompt}
                  onConsumeDraftPrompt={() => setDraftChatPrompt(null)}
                  onChangeReasoningMode={setReasoningMode}
                  onChangeBrainMode={handleChangeBrainMode}
                  onUpdateVoiceSettings={handleUpdateVoiceSettings}
                  onSelectContext={(auditId, issueId, connId) => {
                    setSelectedAuditId(auditId);
                    setFocusedIssueId(issueId);
                    setSelectedConnectionId(connId);
                  }}
                  onSendMessage={handleSendChat}
                  onCancelSending={handleCancelChat}
                  onClearChat={handleClearChat}
                  onGoToTeach={() => switchTab('teach')}
                  onGoToOfflineBrain={() => switchTab('brain')}
                />
              )}

              {activeTab === 'teach' && (
                <TeachArixWorkspace
                  rules={rules}
                  persona={persona}
                  onAddRule={handleAddRule}
                  onUpdateRule={handleUpdateRule}
                  onDeleteRule={handleDeleteRule}
                  onResetRulesToZero={handleResetRulesToZero}
                  onSavePersona={handleSavePersona}
                  onExportBrain={handleExportBrain}
                  onImportBrain={handleImportBrain}
                />
              )}

              {activeTab === 'schedules' && (
                <SchedulesWorkspace
                  tasks={scheduledTasks}
                  connections={connections}
                  onCreateTask={handleCreateSchedule}
                  onToggleTask={handleToggleSchedule}
                  onRunTaskNow={handleRunScheduleNow}
                  onDeleteTask={handleDeleteSchedule}
                />
              )}

              {activeTab === 'history' && (
                <HistoryWorkspace
                  audits={audits}
                  onOpenAudit={(auditId) => {
                    setSelectedAuditId(auditId);
                    setFocusedIssueId(null);
                    switchTab('analyze');
                  }}
                  onDeleteAudit={handleDeleteAudit}
                  onStartNew={() => switchTab('analyze')}
                />
              )}

              {activeCustomSection && (
                <SelfSectionFrame
                  section={activeCustomSection}
                  onAskArixToModify={handleAskArixToModifySection}
                  onDeleteSection={handleDeleteSection}
                />
              )}
            </>
          )}
        </main>
      </div>

      <DesktopAppModal
        open={desktopModalOpen}
        onClose={() => setDesktopModalOpen(false)}
      />
      <OfflineIndicator />
    </div>
  );
}
