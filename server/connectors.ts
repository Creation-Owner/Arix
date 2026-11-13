import { normalizeAndValidateUrl, scrapeWebsite } from './scraper.ts';
import type { ConnectedSiteType } from '../src/types/arix.ts';

export interface SyncResult {
  statusText: string;
  metadataSummary: string;
  normalizedTargetUrl?: string;
  normalizedIdentifier?: string;
}

export function parseGitHubOwnerRepo(input: string): {
  owner: string;
  repo: string;
} | null {
  const cleaned = input.trim().replace(/\.git$/i, '');
  const urlMatch = cleaned.match(
    /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const slashMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2] };
  }
  return null;
}

export async function inspectGitHubRepository(
  owner: string,
  repo: string,
  token?: string,
  filePath?: string
): Promise<{ ok: boolean; summary: string; data?: unknown }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Arix-AI-Workspace',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (filePath) {
    const cleanPath = filePath.replace(/^\/+/, '');
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`,
      { headers }
    );
    if (!fileRes.ok) {
      return {
        ok: false,
        summary: `GitHub API returned ${fileRes.status} for ${owner}/${repo}/${cleanPath}.`,
      };
    }
    const fileJson = (await fileRes.json()) as {
      type?: string;
      name?: string;
      size?: number;
      encoding?: string;
      content?: string;
    };
    if (fileJson.content && fileJson.encoding === 'base64') {
      const decoded = Buffer.from(fileJson.content, 'base64').toString('utf-8');
      return {
        ok: true,
        summary: `File ${cleanPath} (${fileJson.size ?? decoded.length} bytes)`,
        data: decoded.slice(0, 14000),
      };
    }
    return {
      ok: true,
      summary: `Directory listing for ${cleanPath}`,
      data: fileJson,
    };
  }

  const [repoRes, contentsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
      headers,
    }),
  ]);

  if (!repoRes.ok) {
    return {
      ok: false,
      summary: `GitHub API returned HTTP ${repoRes.status} for ${owner}/${repo}.`,
    };
  }

  const repoData = (await repoRes.json()) as {
    full_name: string;
    description: string | null;
    language: string | null;
    default_branch: string;
    stargazers_count: number;
    open_issues_count: number;
    private: boolean;
  };

  let rootEntries: string[] = [];
  if (contentsRes.ok) {
    const list = (await contentsRes.json()) as Array<{
      name: string;
      type: string;
    }>;
    if (Array.isArray(list)) {
      rootEntries = list.slice(0, 25).map((e) => `${e.name}${e.type === 'dir' ? '/' : ''}`);
    }
  }

  const summary = [
    `${repoData.full_name} (${repoData.private ? 'Private' : 'Public'})`,
    `Branch: ${repoData.default_branch}`,
    repoData.language ? `Primary: ${repoData.language}` : '',
    `Open issues: ${repoData.open_issues_count}`,
    rootEntries.length > 0 ? `Root files: ${rootEntries.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    ok: true,
    summary,
    data: { repo: repoData, rootEntries },
  };
}

export async function writeGitHubFile(params: {
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  commitMessage?: string;
  branch?: string;
  token?: string;
}): Promise<{ ok: boolean; summary: string; data?: unknown }> {
  const { owner, repo, filePath, content, commitMessage, branch, token } =
    params;

  if (!token?.trim()) {
    return {
      ok: false,
      summary:
        'A GitHub Personal Access Token with Contents write permission is required to add or update files in GitHub. Edit your GitHub connection in Connect Sites and add a token.',
    };
  }

  const cleanPath = filePath.trim().replace(/^\/+/, '');
  if (!cleanPath) {
    return {
      ok: false,
      summary: 'A target filePath inside the repository is required.',
    };
  }

  const encodedPath = cleanPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'User-Agent': 'Arix-AI-Workspace',
    'Content-Type': 'application/json',
  };

  let existingSha: string | undefined;
  const refQuery = branch?.trim()
    ? `?ref=${encodeURIComponent(branch.trim())}`
    : '';
  const checkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${refQuery}`,
    { headers }
  );

  if (checkRes.ok) {
    const existingJson = (await checkRes.json()) as
      | { sha?: string; type?: string }
      | Array<unknown>;
    if (!Array.isArray(existingJson) && existingJson?.sha) {
      existingSha = existingJson.sha;
    }
  }

  const payload: Record<string, unknown> = {
    message: commitMessage?.trim() || `Arix AI: ${existingSha ? 'update' : 'add'} ${cleanPath}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  };
  if (existingSha) payload.sha = existingSha;
  if (branch?.trim()) payload.branch = branch.trim();

  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    }
  );

  const putJson = (await putRes.json()) as {
    message?: string;
    content?: { path?: string; html_url?: string; sha?: string };
    commit?: { sha?: string; html_url?: string };
  };

  if (!putRes.ok) {
    return {
      ok: false,
      summary: `GitHub rejected writing ${cleanPath} to ${owner}/${repo} (HTTP ${putRes.status}): ${putJson.message || 'Check token repo write permissions.'}`,
    };
  }

  const actionWord = existingSha ? 'Updated' : 'Created';
  return {
    ok: true,
    summary: `${actionWord} ${cleanPath} in ${owner}/${repo}${putJson.commit?.sha ? ` (commit ${putJson.commit.sha.slice(0, 7)})` : ''}.`,
    data: {
      action: actionWord.toLowerCase(),
      repo: `${owner}/${repo}`,
      path: putJson.content?.path || cleanPath,
      fileUrl: putJson.content?.html_url,
      commitSha: putJson.commit?.sha,
      commitUrl: putJson.commit?.html_url,
    },
  };
}


export async function queryCloudflareDns(domainOrUrl: string): Promise<{
  domain: string;
  records: Array<{ type: string; data: string; ttl: number }>;
}> {
  let domain = domainOrUrl.trim();
  if (/^https?:\/\//i.test(domain)) {
    domain = new URL(domain).hostname;
  } else {
    domain = domain.split('/')[0];
  }

  const types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'] as const;
  const allRecords: Array<{ type: string; data: string; ttl: number }> = [];

  await Promise.all(
    types.map(async (rtype) => {
      try {
        const res = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
            domain
          )}&type=${rtype}`,
          {
            headers: { Accept: 'application/dns-json' },
          }
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          Answer?: Array<{ data: string; TTL: number }>;
        };
        if (Array.isArray(json.Answer)) {
          for (const ans of json.Answer) {
            allRecords.push({
              type: rtype,
              data: ans.data,
              ttl: ans.TTL,
            });
          }
        }
      } catch {
        // Skip unreachable record type
      }
    })
  );

  return { domain, records: allRecords };
}

export async function inspectCloudflareConnection(
  targetUrlOrDomain: string,
  zoneId?: string,
  token?: string
): Promise<{ ok: boolean; summary: string; data?: unknown }> {
  const parts: string[] = [];
  let zoneData: unknown = null;
  let dnsRecordsApi: unknown = null;

  if (zoneId && token) {
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(
        zoneId.trim()
      )}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const cfJson = (await cfRes.json()) as {
      success?: boolean;
      result?: {
        name: string;
        status: string;
        plan?: { name: string };
        name_servers?: string[];
      };
      errors?: Array<{ message: string }>;
    };
    if (cfJson.success && cfJson.result) {
      zoneData = cfJson.result;
      parts.push(
        `Cloudflare Zone: ${cfJson.result.name} (${cfJson.result.status}${
          cfJson.result.plan?.name ? `, ${cfJson.result.plan.name}` : ''
        })`
      );
      const recRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(
          zoneId.trim()
        )}/dns_records?per_page=25`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (recRes.ok) {
        const recJson = (await recRes.json()) as {
          result?: Array<{ type: string; name: string; content: string; proxied: boolean }>;
        };
        dnsRecordsApi = recJson.result || [];
        parts.push(
          `${Array.isArray(dnsRecordsApi) ? dnsRecordsApi.length : 0} DNS records synced`
        );
      }
    } else {
      parts.push(
        `Cloudflare API note: ${
          cfJson.errors?.[0]?.message || `HTTP ${cfRes.status}`
        }`
      );
    }
  }

  const publicDns = await queryCloudflareDns(targetUrlOrDomain);
  parts.push(
    `Public DNS (${publicDns.domain}): ${publicDns.records.length} records resolved`
  );

  // Also check live HTTP edge headers if domain/URL provided
  let edgeHeaders: Record<string, string> = {};
  try {
    const urlObj = normalizeAndValidateUrl(targetUrlOrDomain);
    const headRes = await fetch(urlObj.toString(), { method: 'HEAD' });
    const cfRay = headRes.headers.get('cf-ray');
    const cfCache = headRes.headers.get('cf-cache-status');
    const server = headRes.headers.get('server');
    edgeHeaders = {
      status: String(headRes.status),
      ...(cfRay ? { 'cf-ray': cfRay } : {}),
      ...(cfCache ? { 'cf-cache-status': cfCache } : {}),
      ...(server ? { server } : {}),
    };
    if (cfRay) {
      parts.push(`Cloudflare Edge Active (cf-ray: ${cfRay})`);
    }
  } catch {
    // Edge head optional
  }

  return {
    ok: true,
    summary: parts.join(' · '),
    data: { zoneData, dnsRecordsApi, publicDns, edgeHeaders },
  };
}

export async function inspectTelegramBot(
  token?: string,
  chatId?: string
): Promise<{
  ok: boolean;
  summary: string;
  botUsername?: string;
  detectedChatId?: string;
}> {
  if (!token?.trim()) {
    return {
      ok: false,
      summary:
        'Telegram Bot Token is required (create a bot via @BotFather on Telegram).',
    };
  }
  const cleanToken = token.trim();
  try {
    const meRes = await fetch(
      `https://api.telegram.org/bot${cleanToken}/getMe`
    );
    const meJson = (await meRes.json()) as {
      ok?: boolean;
      description?: string;
      result?: { username?: string; first_name?: string };
    };
    if (!meJson.ok || !meJson.result) {
      return {
        ok: false,
        summary: `Telegram API error: ${meJson.description || `HTTP ${meRes.status}`}`,
      };
    }

    let resolvedChatId = chatId?.trim() || '';
    if (!resolvedChatId) {
      const updRes = await fetch(
        `https://api.telegram.org/bot${cleanToken}/getUpdates?limit=10`
      );
      if (updRes.ok) {
        const updJson = (await updRes.json()) as {
          ok?: boolean;
          result?: Array<{
            message?: { chat?: { id?: number | string; username?: string } };
          }>;
        };
        const lastMsg = updJson.result
          ?.slice()
          .reverse()
          .find((u) => u.message?.chat?.id !== undefined);
        if (lastMsg?.message?.chat?.id !== undefined) {
          resolvedChatId = String(lastMsg.message.chat.id);
        }
      }
    }

    const botUsername = meJson.result.username
      ? `@${meJson.result.username}`
      : meJson.result.first_name || 'Telegram Bot';

    const summary = resolvedChatId
      ? `Bot ${botUsername} verified · Target Chat ID: ${resolvedChatId}`
      : `Bot ${botUsername} verified · Send /start to your bot in Telegram, then click Sync to auto-detect Chat ID (or enter Chat ID manually).`;

    return {
      ok: true,
      summary,
      botUsername,
      detectedChatId: resolvedChatId || undefined,
    };
  } catch (err) {
    return {
      ok: false,
      summary:
        err instanceof Error ? err.message : 'Unable to reach Telegram API.',
    };
  }
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  if (!cleanToken || !cleanChatId) {
    return {
      ok: false,
      error: 'Both Telegram Bot Token and Chat ID are required.',
    };
  }
  const res = await fetch(
    `https://api.telegram.org/bot${cleanToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: text.slice(0, 4096),
      }),
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok) {
    return {
      ok: false,
      error: json.description || `Telegram HTTP ${res.status}`,
    };
  }
  return { ok: true, messageId: json.result?.message_id };
}

export async function testAndSyncConnection(params: {
  type: ConnectedSiteType;
  targetUrl: string;
  identifier: string;
  token?: string;
}): Promise<SyncResult> {
  const { type, targetUrl, identifier, token } = params;

  if (type === 'telegram') {
    const tg = await inspectTelegramBot(token, identifier);
    return {
      statusText: tg.ok ? 'Connected' : 'Needs setup',
      metadataSummary: tg.summary,
      normalizedTargetUrl: tg.botUsername
        ? `https://t.me/${tg.botUsername.replace(/^@/, '')}`
        : targetUrl || 'https://t.me',
      normalizedIdentifier: tg.detectedChatId || identifier,
    };
  }

  if (type === 'github') {
    const parsed = parseGitHubOwnerRepo(identifier || targetUrl);
    if (!parsed) {
      return {
        statusText: 'Needs owner/repo',
        metadataSummary:
          'Enter a GitHub repository like owner/repo or https://github.com/owner/repo.',
      };
    }
    const gh = await inspectGitHubRepository(
      parsed.owner,
      parsed.repo,
      token
    );
    return {
      statusText: gh.ok ? 'Connected' : 'Connection warning',
      metadataSummary: gh.summary,
      normalizedTargetUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      normalizedIdentifier: `${parsed.owner}/${parsed.repo}`,
    };
  }

  if (type === 'cloudflare') {
    const domainInput = targetUrl || identifier;
    const cf = await inspectCloudflareConnection(
      domainInput,
      identifier && !identifier.includes('.') ? identifier : undefined,
      token
    );
    return {
      statusText: cf.ok ? 'Connected' : 'Connection warning',
      metadataSummary: cf.summary,
    };
  }

  // Generic website or REST API endpoint
  try {
    const urlObj = normalizeAndValidateUrl(targetUrl);
    if (type === 'api') {
      const headers: Record<string, string> = {
        Accept: 'application/json, text/plain, */*',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const start = Date.now();
      const res = await fetch(urlObj.toString(), { headers });
      const ms = Date.now() - start;
      return {
        statusText: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
        metadataSummary: `Endpoint responded in ${ms} ms (${res.headers.get('content-type') || 'unknown type'})`,
        normalizedTargetUrl: urlObj.toString(),
      };
    }

    const scraped = await scrapeWebsite(urlObj.toString());
    const s = scraped.signals;
    return {
      statusText: s.httpStatus ? `HTTP ${s.httpStatus}` : 'Reachable',
      metadataSummary: [
        s.title ? `Title: "${s.title.slice(0, 60)}"` : 'No title tag',
        s.loadTimeMs !== undefined ? `${s.loadTimeMs} ms` : '',
        s.imagesMissingAlt !== undefined
          ? `${s.imagesMissingAlt} imgs missing alt`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      normalizedTargetUrl: s.fetchedUrl || urlObj.toString(),
    };
  } catch (err) {
    return {
      statusText: 'Warning',
      metadataSummary:
        err instanceof Error ? err.message : 'Unable to reach endpoint.',
    };
  }
}
