export type RuleCategory =
  | 'coding'
  | 'analysis_ux'
  | 'connections'
  | 'automation'
  | 'owner_directive';

export type RuleWeight = 'strict' | 'preferred' | 'advisory';

export interface TaughtRule {
  id: string;
  title: string;
  instruction: string;
  category: RuleCategory;
  weight: RuleWeight;
  active: boolean;
  createdAt: string;
  source: 'manual' | 'chat';
}

export type ArixVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface PersonaSettings {
  ownerName: string;
  primaryGoal: string;
  techStack: string;
  codingStyle: string;
  tonePreference: string;
  customDirective: string;
  voiceName?: ArixVoiceName;
  autoSpeak?: boolean;
}

export type ConnectedSiteType =
  | 'website'
  | 'github'
  | 'cloudflare'
  | 'telegram'
  | 'api';

export interface ConnectedSite {
  id: string;
  name: string;
  type: ConnectedSiteType;
  targetUrl: string;
  identifier: string;
  hasToken: boolean;
  maskedToken?: string;
  active: boolean;
  createdAt: string;
  lastSyncedAt?: string;
  lastStatus?: string;
  metadataSummary?: string;
}

export interface ComputerEntry {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  sizeBytes: number;
  modifiedAt: string;
}

export type IssuePriority = 'P0 Critical' | 'P1 High' | 'P2 Medium' | 'P3 Low';

export type IssueCategory =
  | 'Error & Bug'
  | 'Accessibility'
  | 'Performance'
  | 'Usability & Flow'
  | 'Mobile UX'
  | 'SEO & Structure'
  | 'Custom Rule';

export interface ImpactDimensions {
  taskCompletion: number;
  accessibility: number;
  perceivedSpeed: number;
  trustAndClarity: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  priority: IssuePriority;
  uxImpactScore: number;
  category: IssueCategory;
  affectedArea: string;
  userExperienceImpact: string;
  evidence: string;
  solutionSummary: string;
  beforeCode: string;
  afterCode: string;
  matchedTaughtRule: string;
  impactDimensions: ImpactDimensions;
  status: 'open' | 'resolved';
}

export interface TechnicalSignals {
  fetchedUrl?: string;
  httpStatus?: number;
  loadTimeMs?: number;
  htmlSizeBytes?: number;
  title?: string;
  titleLength?: number;
  metaDescription?: string;
  hasViewportMeta?: boolean;
  hasLangAttr?: boolean;
  h1Count?: number;
  headingJumpDetected?: boolean;
  totalImages?: number;
  imagesMissingAlt?: number;
  unlabeledInputs?: number;
  emptyInteractiveElements?: number;
  insecureBlankLinks?: number;
  blockingScripts?: number;
  securityHeadersPresent?: string[];
  missingSecurityHeaders?: string[];
  fetchWarning?: string;
}

export interface WebsiteAudit {
  id: string;
  targetLabel: string;
  inputType: 'url' | 'code' | 'screenshot';
  url?: string;
  analyzedAt: string;
  summary: string;
  uxPrioritizationRationale: string;
  appliedRulesUsed: string[];
  technicalSignals?: TechnicalSignals;
  issues: AuditIssue[];
}

export type ReasoningMode = 'fast' | 'balanced' | 'deep';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind?: 'image' | 'pdf' | 'text';
  dataUrl?: string;
  textContent?: string;
  sizeBytes?: number;
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'arix';
  content: string;
  attachments?: ChatAttachment[];
  sources?: ChatSource[];
  thinkingSummary?: string;
  reasoningMode?: ReasoningMode;
  timestamp: string;
  auditId?: string;
  issueId?: string;
  issueTitle?: string;
  newlyLearnedRules?: TaughtRule[];
  appliedRulesUsed?: string[];
  toolsInvoked?: string[];
}

export interface CustomSection {
  id: string;
  title: string;
  navLabel: string;
  description: string;
  placement: 'sidebar_tab' | 'main_page' | 'both';
  htmlCode: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduledTaskAction = 'command' | 'site_check' | 'telegram_message';

export interface ScheduledTask {
  id: string;
  title: string;
  actionType: ScheduledTaskAction;
  intervalMinutes: number;
  promptOrMessage: string;
  targetUrl?: string;
  telegramConnectionId?: string;
  active: boolean;
  createdAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus?: 'ok' | 'error';
  lastResult?: string;
  runCount: number;
}

export interface WebsiteWidgetSettings {
  enabled: boolean;
  assistantName: string;
  tagline: string;
  welcomeMessage: string;
  placeholder: string;
  accentColor: string;
  position: 'bottom-right' | 'bottom-left';
  allowedOrigins: string;
  siteKnowledge: string;
  publicKey: string;
  requirePublicKey: boolean;
}

export interface ArixStatePayload {
  rules: TaughtRule[];
  persona: PersonaSettings;
  connections: ConnectedSite[];
  audits: WebsiteAudit[];
  chatHistory: ChatMessage[];
  customSections: CustomSection[];
  scheduledTasks: ScheduledTask[];
  widgetSettings: WebsiteWidgetSettings;
  computerRoot: string;
}

export type ArixSatelliteKey =
  | 'core'
  | 'text'
  | 'compute'
  | 'code'
  | 'network';

export type ArixNodeState = 'idle' | 'working' | 'done' | 'error';

export interface ArixActivityEvent {
  id: string;
  timestamp: string;
  phase: 'idle' | 'thinking' | 'tool_start' | 'tool_done' | 'done' | 'error';
  node: ArixSatelliteKey;
  toolName?: string;
  title: string;
  detail: string;
}

export interface ArixLiveStatus {
  busy: boolean;
  activeNode: ArixSatelliteKey;
  headline: string;
  detail: string;
  nodeStatuses: Record<
    ArixSatelliteKey,
    { state: ArixNodeState; label: string }
  >;
  events: ArixActivityEvent[];
}

