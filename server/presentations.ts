import fs from 'fs';
import path from 'path';
import PptxGenJS from 'pptxgenjs';

export type PresentationThemeKey =
  | 'midnight_blue'
  | 'clean_light'
  | 'executive_slate'
  | 'emerald_tech';

export type SlideLayoutType =
  | 'title'
  | 'bullets'
  | 'two_column'
  | 'metrics'
  | 'quote';

export interface SlideMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface PresentationSlideInput {
  layout?: SlideLayoutType;
  heading: string;
  subheading?: string;
  bullets?: string[];
  leftHeading?: string;
  leftItems?: string[];
  rightHeading?: string;
  rightItems?: string[];
  metrics?: SlideMetric[];
  quote?: string;
  quoteAuthor?: string;
  notes?: string;
}

export interface CreatePresentationInput {
  title: string;
  subtitle?: string;
  author?: string;
  theme?: PresentationThemeKey;
  fileName?: string;
  computerRoot: string;
  slides: PresentationSlideInput[];
}

export interface CreatedPresentationResult {
  title: string;
  theme: PresentationThemeKey;
  fileName: string;
  relativePath: string;
  absolutePath: string;
  downloadUrl: string;
  slideCount: number;
  interactiveHtml: string;
}

interface ThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
}

const THEMES: Record<PresentationThemeKey, ThemePalette> = {
  midnight_blue: {
    bg: '060E1F',
    surface: '0B152B',
    surfaceAlt: '111F3D',
    text: 'F8FAFC',
    muted: '94A3B8',
    accent: '38BDF8',
    accentText: '020617',
    border: '1E293B',
  },
  clean_light: {
    bg: 'F8FAFC',
    surface: 'FFFFFF',
    surfaceAlt: 'F1F5F9',
    text: '0F172A',
    muted: '475569',
    accent: '0284C7',
    accentText: 'FFFFFF',
    border: 'CBD5E1',
  },
  executive_slate: {
    bg: '0F172A',
    surface: '1E293B',
    surfaceAlt: '293548',
    text: 'F8FAFC',
    muted: 'CBD5E1',
    accent: 'F59E0B',
    accentText: '0F172A',
    border: '334155',
  },
  emerald_tech: {
    bg: '041614',
    surface: '092421',
    surfaceAlt: '0F332E',
    text: 'ECFDF5',
    muted: 'A7F3D0',
    accent: '10B981',
    accentText: '022C22',
    border: '115E59',
  },
};

function sanitizePptxFileName(rawName: string | undefined, title: string): string {
  const base = (rawName || title || 'arix-presentation')
    .trim()
    .replace(/\.pptx$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'arix-presentation'}.pptx`;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildInteractiveViewerHtml(params: {
  title: string;
  subtitle?: string;
  theme: PresentationThemeKey;
  palette: ThemePalette;
  downloadUrl: string;
  fileName: string;
  slides: PresentationSlideInput[];
}): string {
  const { title, subtitle, palette, downloadUrl, fileName, slides } = params;

  const slidesJson = JSON.stringify(slides).replace(/</g, '\\u003c');

  return `<style>
  :root {
    --deck-bg: #${palette.bg};
    --deck-surface: #${palette.surface};
    --deck-surface-alt: #${palette.surfaceAlt};
    --deck-text: #${palette.text};
    --deck-muted: #${palette.muted};
    --deck-accent: #${palette.accent};
    --deck-accent-text: #${palette.accentText};
    --deck-border: #${palette.border};
  }
  body {
    margin: 0;
    padding: 16px;
    background: #060E1F;
    color: #F8FAFC;
    font-family: "DM Sans", system-ui, -apple-system, sans-serif;
  }
  .deck-shell {
    max-width: 980px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .deck-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #081124;
    border: 1px solid #1E293B;
    border-radius: 12px;
    padding: 10px 14px;
  }
  .deck-meta-title {
    font-size: 14px;
    font-weight: 700;
    color: #F8FAFC;
  }
  .deck-meta-sub {
    font-size: 12px;
    color: #94A3B8;
  }
  .deck-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #334155;
    background: #0B152B;
    color: #E2E8F0;
    text-decoration: none;
  }
  .btn:hover { background: #1E293B; }
  .btn-primary {
    background: #38BDF8;
    color: #020617;
    border-color: #38BDF8;
  }
  .btn-primary:hover { background: #7DD3FC; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .slide-stage {
    aspect-ratio: 16 / 9;
    width: 100%;
    background: var(--deck-bg);
    color: var(--deck-text);
    border: 1px solid var(--deck-border);
    border-radius: 14px;
    padding: 34px 40px 26px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.45);
  }
  .slide-accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: var(--deck-accent);
  }
  .slide-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    min-height: 0;
  }
  .slide-heading {
    margin: 0;
    font-size: clamp(20px, 2.8vw, 32px);
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: -0.02em;
  }
  .slide-subheading {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--deck-muted);
    line-height: 1.45;
  }
  .bullets-box {
    background: var(--deck-surface);
    border: 1px solid var(--deck-border);
    border-radius: 12px;
    padding: 18px 22px;
  }
  .bullets-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: clamp(13px, 1.5vw, 16px);
    line-height: 1.45;
  }
  .bullets-list li::marker {
    color: var(--deck-accent);
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .col-card {
    background: var(--deck-surface);
    border: 1px solid var(--deck-border);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .col-title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 700;
    color: var(--deck-accent);
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 14px;
  }
  .metric-card {
    background: var(--deck-surface);
    border: 1px solid var(--deck-border);
    border-top: 3px solid var(--deck-accent);
    border-radius: 12px;
    padding: 16px;
  }
  .metric-value {
    font-size: clamp(22px, 2.8vw, 34px);
    font-weight: 800;
    color: var(--deck-accent);
    line-height: 1.1;
  }
  .metric-label {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
  }
  .metric-detail {
    margin-top: 4px;
    font-size: 12px;
    color: var(--deck-muted);
  }
  .quote-card {
    background: var(--deck-surface);
    border-left: 4px solid var(--deck-accent);
    border-radius: 12px;
    padding: 24px 28px;
  }
  .quote-text {
    font-size: clamp(16px, 2vw, 22px);
    font-weight: 600;
    line-height: 1.45;
  }
  .quote-author {
    margin-top: 12px;
    font-size: 13px;
    color: var(--deck-accent);
    font-weight: 600;
  }
  .slide-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--deck-muted);
    padding-top: 10px;
    border-top: 1px solid var(--deck-border);
  }
  .notes-panel {
    background: #081124;
    border: 1px solid #1E293B;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12px;
    color: #CBD5E1;
    line-height: 1.5;
  }
  .notes-label {
    font-size: 11px;
    font-weight: 700;
    color: #38BDF8;
    margin-bottom: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .dots-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .dot-btn {
    padding: 4px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid #1E293B;
    background: #081124;
    color: #94A3B8;
    cursor: pointer;
  }
  .dot-btn.active {
    background: #38BDF8;
    color: #020617;
    border-color: #38BDF8;
  }
</style>

<div class="deck-shell" id="deckRoot">
  <div class="deck-toolbar">
    <div>
      <div class="deck-meta-title">${escapeHtml(title)}</div>
      <div class="deck-meta-sub">${escapeHtml(subtitle || `${slides.length} slides · Exported as ${fileName}`)}</div>
    </div>
    <div class="deck-actions">
      <button type="button" class="btn" id="prevBtn">← Prev</button>
      <span id="counterLabel" style="font-size:12px;font-family:monospace;color:#94A3B8;">1 / ${slides.length}</span>
      <button type="button" class="btn" id="nextBtn">Next →</button>
      <button type="button" class="btn" id="fsBtn">Fullscreen</button>
      <a class="btn btn-primary" href="${escapeHtml(downloadUrl)}" download="${escapeHtml(fileName)}">Download .pptx</a>
    </div>
  </div>

  <div class="slide-stage" id="slideStage">
    <div class="slide-accent-bar"></div>
    <div class="slide-body" id="slideBody"></div>
    <div class="slide-footer">
      <span>${escapeHtml(title)}</span>
      <span id="slideFooterNum">Slide 1 of ${slides.length}</span>
    </div>
  </div>

  <div class="dots-row" id="dotsRow"></div>

  <div class="notes-panel" id="notesPanel">
    <div class="notes-label">Speaker Notes</div>
    <div id="notesText"></div>
  </div>
</div>

<script>
(function() {
  const slides = ${slidesJson};
  let index = 0;

  const slideBody = document.getElementById('slideBody');
  const counterLabel = document.getElementById('counterLabel');
  const slideFooterNum = document.getElementById('slideFooterNum');
  const notesPanel = document.getElementById('notesPanel');
  const notesText = document.getElementById('notesText');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const dotsRow = document.getElementById('dotsRow');
  const fsBtn = document.getElementById('fsBtn');
  const slideStage = document.getElementById('slideStage');

  function esc(val) {
    return String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function render() {
    const s = slides[index] || { heading: 'Slide' };
    const layout = s.layout || (index === 0 ? 'title' : 'bullets');
    let html = '';

    if (layout === 'title') {
      html = '<div style="padding:12px 0;">' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--deck-accent);margin-bottom:10px;">Presentation Deck</div>' +
        '<h2 class="slide-heading" style="font-size:clamp(26px,3.6vw,40px);">' + esc(s.heading) + '</h2>' +
        (s.subheading ? '<p class="slide-subheading" style="font-size:16px;max-width:720px;">' + esc(s.subheading) + '</p>' : '') +
        (Array.isArray(s.bullets) && s.bullets.length ? '<ul class="bullets-list" style="margin-top:18px;">' + s.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '') +
      '</div>';
    } else if (layout === 'two_column') {
      const left = Array.isArray(s.leftItems) ? s.leftItems : (Array.isArray(s.bullets) ? s.bullets.slice(0, Math.ceil(s.bullets.length / 2)) : []);
      const right = Array.isArray(s.rightItems) ? s.rightItems : (Array.isArray(s.bullets) ? s.bullets.slice(Math.ceil(s.bullets.length / 2)) : []);
      html = '<div><h2 class="slide-heading">' + esc(s.heading) + '</h2>' +
        (s.subheading ? '<p class="slide-subheading">' + esc(s.subheading) + '</p>' : '') +
        '</div>' +
        '<div class="two-col">' +
          '<div class="col-card"><h3 class="col-title">' + esc(s.leftHeading || 'Key Points') + '</h3><ul class="bullets-list">' + left.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></div>' +
          '<div class="col-card"><h3 class="col-title">' + esc(s.rightHeading || 'Action Plan') + '</h3><ul class="bullets-list">' + right.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></div>' +
        '</div>';
    } else if (layout === 'metrics') {
      const metrics = Array.isArray(s.metrics) && s.metrics.length
        ? s.metrics
        : (Array.isArray(s.bullets) ? s.bullets.map((b, idx) => ({ label: 'Highlight ' + (idx + 1), value: b })) : []);
      html = '<div><h2 class="slide-heading">' + esc(s.heading) + '</h2>' +
        (s.subheading ? '<p class="slide-subheading">' + esc(s.subheading) + '</p>' : '') +
        '</div>' +
        '<div class="metrics-grid">' +
          metrics.map(m =>
            '<div class="metric-card">' +
              '<div class="metric-value">' + esc(m.value) + '</div>' +
              '<div class="metric-label">' + esc(m.label) + '</div>' +
              (m.detail ? '<div class="metric-detail">' + esc(m.detail) + '</div>' : '') +
            '</div>'
          ).join('') +
        '</div>';
    } else if (layout === 'quote') {
      html = '<div><h2 class="slide-heading">' + esc(s.heading) + '</h2></div>' +
        '<div class="quote-card">' +
          '<div class="quote-text">&ldquo;' + esc(s.quote || s.subheading || (s.bullets && s.bullets[0]) || '') + '&rdquo;</div>' +
          (s.quoteAuthor ? '<div class="quote-author">— ' + esc(s.quoteAuthor) + '</div>' : '') +
        '</div>';
    } else {
      const bullets = Array.isArray(s.bullets) ? s.bullets : [];
      html = '<div><h2 class="slide-heading">' + esc(s.heading) + '</h2>' +
        (s.subheading ? '<p class="slide-subheading">' + esc(s.subheading) + '</p>' : '') +
        '</div>' +
        '<div class="bullets-box"><ul class="bullets-list">' +
          bullets.map(b => '<li>' + esc(b) + '</li>').join('') +
        '</ul></div>';
    }

    slideBody.innerHTML = html;
    counterLabel.textContent = (index + 1) + ' / ' + slides.length;
    slideFooterNum.textContent = 'Slide ' + (index + 1) + ' of ' + slides.length;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === slides.length - 1;

    if (s.notes) {
      notesPanel.style.display = 'block';
      notesText.textContent = s.notes;
    } else {
      notesPanel.style.display = 'none';
    }

    dotsRow.innerHTML = '';
    slides.forEach((_, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dot-btn' + (idx === index ? ' active' : '');
      btn.textContent = String(idx + 1);
      btn.addEventListener('click', () => { index = idx; render(); });
      dotsRow.appendChild(btn);
    });
  }

  prevBtn.addEventListener('click', () => { if (index > 0) { index--; render(); } });
  nextBtn.addEventListener('click', () => { if (index < slides.length - 1) { index++; render(); } });
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      slideStage.requestFullscreen?.();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && index < slides.length - 1) { index++; render(); }
    if (e.key === 'ArrowLeft' && index > 0) { index--; render(); }
  });

  render();
})();
</script>`;
}

export async function buildPresentationDeck(
  input: CreatePresentationInput
): Promise<CreatedPresentationResult> {
  const theme: PresentationThemeKey =
    input.theme && THEMES[input.theme] ? input.theme : 'midnight_blue';
  const palette = THEMES[theme];
  const fileName = sanitizePptxFileName(input.fileName, input.title);

  const slidesInput =
    Array.isArray(input.slides) && input.slides.length > 0
      ? input.slides
      : [
          {
            layout: 'title' as const,
            heading: input.title,
            subheading: input.subtitle || 'Created with Arix Autonomous AI',
          },
        ];

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = input.author || 'Arix Autonomous AI';
  pptx.title = input.title;
  pptx.subject = input.subtitle || input.title;

  slidesInput.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: palette.bg };

    // Top accent bar on every slide
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: palette.accent },
      line: { color: palette.accent, width: 0 },
    });

    const layout: SlideLayoutType = s.layout || (idx === 0 ? 'title' : 'bullets');

    if (layout === 'title') {
      slide.addText('PRESENTATION DECK', {
        x: 0.7,
        y: 1.25,
        w: 8.6,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: palette.accent,
        fontFace: 'Calibri',
      });
      slide.addText(s.heading || input.title, {
        x: 0.7,
        y: 1.65,
        w: 8.6,
        h: 1.4,
        fontSize: 34,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
        valign: 'top',
      });
      if (s.subheading || input.subtitle) {
        slide.addText(s.subheading || input.subtitle || '', {
          x: 0.7,
          y: 3.15,
          w: 8.2,
          h: 0.9,
          fontSize: 16,
          color: palette.muted,
          fontFace: 'Calibri',
          valign: 'top',
        });
      }
      if (Array.isArray(s.bullets) && s.bullets.length > 0) {
        slide.addText(
          s.bullets.map((b) => ({
            text: b,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: 0.7,
            y: 4.1,
            w: 8.5,
            h: 1.0,
            fontSize: 13,
            color: palette.text,
            fontFace: 'Calibri',
          }
        );
      }
    } else if (layout === 'two_column') {
      slide.addText(s.heading, {
        x: 0.6,
        y: 0.35,
        w: 8.8,
        h: 0.65,
        fontSize: 24,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
      });
      if (s.subheading) {
        slide.addText(s.subheading, {
          x: 0.6,
          y: 0.95,
          w: 8.8,
          h: 0.4,
          fontSize: 13,
          color: palette.muted,
          fontFace: 'Calibri',
        });
      }
      const cardY = s.subheading ? 1.45 : 1.15;
      const cardH = s.subheading ? 3.55 : 3.85;
      // Left card
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.6,
        y: cardY,
        w: 4.25,
        h: cardH,
        rectRadius: 0.08,
        fill: { color: palette.surface },
        line: { color: palette.border, width: 1 },
      });
      slide.addText(s.leftHeading || 'Key Points', {
        x: 0.85,
        y: cardY + 0.2,
        w: 3.75,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: palette.accent,
        fontFace: 'Calibri',
      });
      const leftItems =
        Array.isArray(s.leftItems) && s.leftItems.length > 0
          ? s.leftItems
          : (s.bullets || []).slice(0, Math.ceil((s.bullets || []).length / 2));
      if (leftItems.length > 0) {
        slide.addText(
          leftItems.map((item) => ({
            text: item,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: 0.85,
            y: cardY + 0.68,
            w: 3.75,
            h: cardH - 0.85,
            fontSize: 13.5,
            color: palette.text,
            fontFace: 'Calibri',
            valign: 'top',
            paraSpaceAfter: 6,
          }
        );
      }

      // Right card
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 5.15,
        y: cardY,
        w: 4.25,
        h: cardH,
        rectRadius: 0.08,
        fill: { color: palette.surface },
        line: { color: palette.border, width: 1 },
      });
      slide.addText(s.rightHeading || 'Action Plan', {
        x: 5.4,
        y: cardY + 0.2,
        w: 3.75,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: palette.accent,
        fontFace: 'Calibri',
      });
      const rightItems =
        Array.isArray(s.rightItems) && s.rightItems.length > 0
          ? s.rightItems
          : (s.bullets || []).slice(Math.ceil((s.bullets || []).length / 2));
      if (rightItems.length > 0) {
        slide.addText(
          rightItems.map((item) => ({
            text: item,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: 5.4,
            y: cardY + 0.68,
            w: 3.75,
            h: cardH - 0.85,
            fontSize: 13.5,
            color: palette.text,
            fontFace: 'Calibri',
            valign: 'top',
            paraSpaceAfter: 6,
          }
        );
      }
    } else if (layout === 'metrics') {
      slide.addText(s.heading, {
        x: 0.6,
        y: 0.35,
        w: 8.8,
        h: 0.65,
        fontSize: 24,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
      });
      if (s.subheading) {
        slide.addText(s.subheading, {
          x: 0.6,
          y: 0.95,
          w: 8.8,
          h: 0.4,
          fontSize: 13,
          color: palette.muted,
          fontFace: 'Calibri',
        });
      }
      const metricsList: SlideMetric[] = (
        Array.isArray(s.metrics) && s.metrics.length > 0
          ? s.metrics
          : (s.bullets || []).map((b, mIdx) => ({
              label: `Metric ${mIdx + 1}`,
              value: b,
              detail: '',
            }))
      ).slice(0, 4);

      const count = Math.max(1, metricsList.length);
      const gap = 0.25;
      const totalW = 8.8;
      const cardW = (totalW - gap * (count - 1)) / count;
      const cardY = 1.65;
      const cardH = 3.1;

      metricsList.forEach((m, mIdx) => {
        const cx = 0.6 + mIdx * (cardW + gap);
        slide.addShape(pptx.ShapeType.roundRect, {
          x: cx,
          y: cardY,
          w: cardW,
          h: cardH,
          rectRadius: 0.08,
          fill: { color: palette.surface },
          line: { color: palette.border, width: 1 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: cx,
          y: cardY,
          w: cardW,
          h: 0.07,
          fill: { color: palette.accent },
          line: { color: palette.accent, width: 0 },
        });
        slide.addText(String(m.value || ''), {
          x: cx + 0.18,
          y: cardY + 0.32,
          w: cardW - 0.36,
          h: 0.85,
          fontSize: 26,
          bold: true,
          color: palette.accent,
          fontFace: 'Calibri',
        });
        slide.addText(String(m.label || ''), {
          x: cx + 0.18,
          y: cardY + 1.25,
          w: cardW - 0.36,
          h: 0.55,
          fontSize: 13.5,
          bold: true,
          color: palette.text,
          fontFace: 'Calibri',
        });
        if (m.detail) {
          slide.addText(String(m.detail), {
            x: cx + 0.18,
            y: cardY + 1.85,
            w: cardW - 0.36,
            h: 1.0,
            fontSize: 11.5,
            color: palette.muted,
            fontFace: 'Calibri',
            valign: 'top',
          });
        }
      });
    } else if (layout === 'quote') {
      slide.addText(s.heading, {
        x: 0.6,
        y: 0.4,
        w: 8.8,
        h: 0.6,
        fontSize: 22,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 1.5,
        w: 8.4,
        h: 2.8,
        rectRadius: 0.1,
        fill: { color: palette.surface },
        line: { color: palette.border, width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: 1.5,
        w: 0.1,
        h: 2.8,
        fill: { color: palette.accent },
        line: { color: palette.accent, width: 0 },
      });
      const quoteBody =
        s.quote || s.subheading || (s.bullets && s.bullets[0]) || '';
      slide.addText(`"${quoteBody}"`, {
        x: 1.15,
        y: 1.8,
        w: 7.75,
        h: 1.65,
        fontSize: 20,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
        valign: 'middle',
      });
      if (s.quoteAuthor) {
        slide.addText(`— ${s.quoteAuthor}`, {
          x: 1.15,
          y: 3.6,
          w: 7.75,
          h: 0.45,
          fontSize: 13,
          bold: true,
          color: palette.accent,
          fontFace: 'Calibri',
        });
      }
    } else {
      slide.addText(s.heading, {
        x: 0.6,
        y: 0.35,
        w: 8.8,
        h: 0.65,
        fontSize: 24,
        bold: true,
        color: palette.text,
        fontFace: 'Calibri',
      });
      if (s.subheading) {
        slide.addText(s.subheading, {
          x: 0.6,
          y: 0.95,
          w: 8.8,
          h: 0.4,
          fontSize: 13,
          color: palette.muted,
          fontFace: 'Calibri',
        });
      }
      const boxY = s.subheading ? 1.45 : 1.15;
      const boxH = s.subheading ? 3.55 : 3.85;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.6,
        y: boxY,
        w: 8.8,
        h: boxH,
        rectRadius: 0.08,
        fill: { color: palette.surface },
        line: { color: palette.border, width: 1 },
      });
      if (Array.isArray(s.bullets) && s.bullets.length > 0) {
        slide.addText(
          s.bullets.map((b) => ({
            text: b,
            options: { bullet: true, breakLine: true },
          })),
          {
            x: 0.9,
            y: boxY + 0.25,
            w: 8.2,
            h: boxH - 0.5,
            fontSize: 15,
            color: palette.text,
            fontFace: 'Calibri',
            valign: 'top',
            paraSpaceAfter: 9,
          }
        );
      }
    }

    // Slide footer
    slide.addText(input.title, {
      x: 0.6,
      y: 5.2,
      w: 6.5,
      h: 0.28,
      fontSize: 9.5,
      color: palette.muted,
      fontFace: 'Calibri',
    });
    slide.addText(`Slide ${idx + 1} / ${slidesInput.length}`, {
      x: 7.4,
      y: 5.2,
      w: 2.0,
      h: 0.28,
      fontSize: 9.5,
      color: palette.muted,
      align: 'right',
      fontFace: 'Calibri',
    });

    if (s.notes) {
      slide.addNotes(s.notes);
    }
  });

  const presentationsDir = path.join(input.computerRoot, 'presentations');
  if (!fs.existsSync(presentationsDir)) {
    fs.mkdirSync(presentationsDir, { recursive: true });
  }
  const absolutePath = path.join(presentationsDir, fileName);
  const relativePath = path.posix.join('presentations', fileName);

  await pptx.writeFile({ fileName: absolutePath });

  const downloadUrl = `/api/presentations/${encodeURIComponent(fileName)}`;
  const interactiveHtml = buildInteractiveViewerHtml({
    title: input.title,
    subtitle: input.subtitle,
    theme,
    palette,
    downloadUrl,
    fileName,
    slides: slidesInput,
  });

  return {
    title: input.title,
    theme,
    fileName,
    relativePath,
    absolutePath,
    downloadUrl,
    slideCount: slidesInput.length,
    interactiveHtml,
  };
}
