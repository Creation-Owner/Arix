import type { TechnicalSignals } from '../src/types/arix.ts';

export interface ScrapedWebsiteResult {
  signals: TechnicalSignals;
  htmlExcerpt: string;
  textExcerpt: string;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function normalizeAndValidateUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname))) {
    throw new Error('Private or loopback network addresses cannot be scanned.');
  }
  return parsed;
}

export function analyzeHtmlSignals(
  html: string,
  extra?: Partial<TechnicalSignals>
): { signals: TechnicalSignals; textExcerpt: string; htmlExcerpt: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const descMatch =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
    );
  const metaDescription = descMatch ? descMatch[1].trim() : '';

  const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
  const hasLangAttr = /<html[^>]+lang=["'][a-zA-Z-]+["'][^>]*>/i.test(html);

  const headingMatches = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) =>
    Number(m[1])
  );
  const h1Count = headingMatches.filter((lvl) => lvl === 1).length;
  let headingJumpDetected = false;
  for (let i = 1; i < headingMatches.length; i++) {
    if (headingMatches[i] - headingMatches[i - 1] > 1) {
      headingJumpDetected = true;
      break;
    }
  }

  const imgTags = [...html.matchAll(/<img\b([^>]*)>/gi)];
  const totalImages = imgTags.length;
  const imagesMissingAlt = imgTags.filter((m) => {
    const attrs = m[1];
    return !/\balt\s*=/i.test(attrs);
  }).length;

  const inputTags = [
    ...html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi),
  ].filter((m) => !/type=["']hidden["']/i.test(m[2]));
  const labelForIds = new Set(
    [...html.matchAll(/<label[^>]+for=["']([^"']+)["'][^>]*>/gi)].map(
      (m) => m[1]
    )
  );
  const unlabeledInputs = inputTags.filter((m) => {
    const attrs = m[2];
    if (/\baria-label\s*=|\baria-labelledby\s*=/i.test(attrs)) return false;
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    if (idMatch && labelForIds.has(idMatch[1])) return false;
    return true;
  }).length;

  const buttonMatches = [
    ...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
  ];
  const emptyInteractiveElements = buttonMatches.filter((m) => {
    const attrs = m[2];
    const inner = m[3].replace(/<[^>]+>/g, '').trim();
    const hasAria = /\baria-label\s*=|\btitle\s*=/i.test(attrs);
    return !inner && !hasAria;
  }).length;

  const blankLinks = [...html.matchAll(/<a\b([^>]*target=["']_blank["'][^>]*)>/gi)];
  const insecureBlankLinks = blankLinks.filter(
    (m) => !/\brel=["'][^"']*\b(noopener|noreferrer)\b[^"']*["']/i.test(m[1])
  ).length;

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';
  const blockingScripts = [
    ...headHtml.matchAll(/<script\b([^>]*)>/gi),
  ].filter((m) => {
    const attrs = m[1];
    return (
      /\bsrc=/i.test(attrs) &&
      !/\b(async|defer|type=["']module["'])\b/i.test(attrs)
    );
  }).length;

  const strippedText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);

  return {
    signals: {
      htmlSizeBytes: Buffer.byteLength(html, 'utf8'),
      title,
      titleLength: title.length,
      metaDescription,
      hasViewportMeta,
      hasLangAttr,
      h1Count,
      headingJumpDetected,
      totalImages,
      imagesMissingAlt,
      unlabeledInputs,
      emptyInteractiveElements,
      insecureBlankLinks,
      blockingScripts,
      ...extra,
    },
    textExcerpt: strippedText,
    htmlExcerpt: html.slice(0, 14000),
  };
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapedWebsiteResult> {
  const urlObj = normalizeAndValidateUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const startedAt = Date.now();

  try {
    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArixAI/1.0; +https://example.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const loadTimeMs = Date.now() - startedAt;
    const html = await res.text();

    const securityHeaderNames = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
    ];
    const securityHeadersPresent = securityHeaderNames.filter((h) =>
      res.headers.has(h)
    );
    const missingSecurityHeaders = securityHeaderNames.filter(
      (h) => !res.headers.has(h)
    );

    const fetchWarning = !res.ok
      ? `Target server responded with HTTP ${res.status} (${res.statusText}).`
      : undefined;

    const { signals, textExcerpt, htmlExcerpt } = analyzeHtmlSignals(html, {
      fetchedUrl: res.url || urlObj.toString(),
      httpStatus: res.status,
      loadTimeMs,
      securityHeadersPresent,
      missingSecurityHeaders,
      fetchWarning,
    });

    return { signals, textExcerpt, htmlExcerpt };
  } catch (err) {
    const loadTimeMs = Date.now() - startedAt;
    const message =
      err instanceof Error ? err.message : 'Unable to reach target website.';
    return {
      signals: {
        fetchedUrl: urlObj.toString(),
        loadTimeMs,
        fetchWarning: `Direct HTTP fetch encountered an issue (${message}). Arix will use URL Context and available metadata if accessible.`,
      },
      textExcerpt: '',
      htmlExcerpt: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}
