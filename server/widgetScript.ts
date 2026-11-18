export function buildArixWidgetScript(): string {
  return `(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__ARIX_WIDGET_LOADED__) return;
  window.__ARIX_WIDGET_LOADED__ = true;

  var scriptEl = document.currentScript;
  var serverUrl = '';
  var attrKey = '';
  var attrTitle = '';
  var attrColor = '';
  var attrPosition = '';
  var attrWelcome = '';
  var attrPlaceholder = '';

  if (scriptEl) {
    attrKey = scriptEl.getAttribute('data-key') || '';
    attrTitle = scriptEl.getAttribute('data-title') || '';
    attrColor = scriptEl.getAttribute('data-color') || '';
    attrPosition = scriptEl.getAttribute('data-position') || '';
    attrWelcome = scriptEl.getAttribute('data-welcome') || '';
    attrPlaceholder = scriptEl.getAttribute('data-placeholder') || '';
    var explicitServer = scriptEl.getAttribute('data-server');
    if (explicitServer) {
      serverUrl = explicitServer.replace(/\\/+$/, '');
    } else if (scriptEl.src) {
      try {
        serverUrl = new URL(scriptEl.src).origin;
      } catch (e) {
        serverUrl = window.location.origin;
      }
    }
  }
  if (!serverUrl) {
    serverUrl = window.location.origin;
  }

  var storageKey = 'arix_widget_history_' + serverUrl;
  var config = {
    enabled: true,
    assistantName: attrTitle || 'Arix Assistant',
    tagline: 'AI Website Assistant',
    welcomeMessage: attrWelcome || 'Hi! How can I help you today?',
    placeholder: attrPlaceholder || 'Ask a question...',
    accentColor: attrColor || '#38BDF8',
    position: attrPosition === 'bottom-left' ? 'bottom-left' : 'bottom-right'
  };

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(list.slice(-30)));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatReply(text) {
    var safe = escapeHtml(text || '');
    safe = safe.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\`([^\`]+)\`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>');
    safe = safe.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;text-decoration:underline;">$1</a>');
    return safe.replace(/\\n/g, '<br/>');
  }

  function initWidget() {
    if (!config.enabled) return;

    var host = document.createElement('div');
    host.id = 'arix-website-assistant-root';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });
    var isLeft = config.position === 'bottom-left';
    var accent = /^#[0-9a-fA-F]{3,8}$/.test(config.accentColor) ? config.accentColor : '#38BDF8';

    var style = document.createElement('style');
    style.textContent = [
      ':host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.arix-wrap { position: fixed; bottom: 20px; ' + (isLeft ? 'left: 20px;' : 'right: 20px;') + ' z-index: 2147483000; display: flex; flex-direction: column; align-items: ' + (isLeft ? 'flex-start' : 'flex-end') + '; gap: 12px; }',
      '.arix-launcher { width: 56px; height: 56px; border-radius: 9999px; border: none; cursor: pointer; background: ' + accent + '; color: #06101f; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 30px rgba(2, 8, 23, 0.45); transition: transform 0.16s ease, filter 0.16s ease; }',
      '.arix-launcher:hover { transform: translateY(-2px) scale(1.03); filter: brightness(1.06); }',
      '.arix-panel { width: 370px; max-width: calc(100vw - 24px); height: 510px; max-height: calc(100vh - 96px); background: #081226; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 16px; box-shadow: 0 22px 54px rgba(2, 6, 23, 0.65); display: none; flex-direction: column; overflow: hidden; color: #e2e8f0; }',
      '.arix-panel.open { display: flex; }',
      '.arix-head { padding: 14px 16px; background: #060e1f; border-bottom: 1px solid rgba(148, 163, 184, 0.16); display: flex; align-items: center; justify-content: space-between; gap: 10px; }',
      '.arix-head-left { display: flex; align-items: center; gap: 10px; min-width: 0; }',
      '.arix-dot { width: 10px; height: 10px; border-radius: 9999px; background: ' + accent + '; box-shadow: 0 0 10px ' + accent + '; flex-shrink: 0; }',
      '.arix-title { font-size: 14px; font-weight: 700; color: #ffffff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.arix-sub { font-size: 11px; color: #94a3b8; margin: 1px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.arix-head-actions { display: flex; align-items: center; gap: 6px; }',
      '.arix-icon-btn { background: transparent; border: 1px solid rgba(148, 163, 184, 0.22); color: #cbd5e1; border-radius: 8px; padding: 4px 8px; font-size: 11px; cursor: pointer; }',
      '.arix-icon-btn:hover { background: rgba(148, 163, 184, 0.14); color: #ffffff; }',
      '.arix-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #081226; }',
      '.arix-msg { max-width: 86%; padding: 10px 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; word-break: break-word; }',
      '.arix-msg.assistant { align-self: flex-start; background: #0f1d38; border: 1px solid rgba(148, 163, 184, 0.16); color: #e2e8f0; }',
      '.arix-msg.user { align-self: flex-end; background: ' + accent + '; color: #06101f; font-weight: 500; }',
      '.arix-form { padding: 12px; background: #060e1f; border-top: 1px solid rgba(148, 163, 184, 0.16); display: flex; gap: 8px; align-items: center; }',
      '.arix-input { flex: 1; background: #0b152b; border: 1px solid rgba(148, 163, 184, 0.25); color: #ffffff; border-radius: 10px; padding: 9px 12px; font-size: 13px; outline: none; font-family: inherit; }',
      '.arix-input:focus { border-color: ' + accent + '; }',
      '.arix-send { background: ' + accent + '; color: #06101f; border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0; }',
      '.arix-send:disabled { opacity: 0.5; cursor: not-allowed; }'
    ].join('\\n');
    shadow.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'arix-wrap';
    wrap.innerHTML = [
      '<div class="arix-panel" role="dialog" aria-label="' + escapeHtml(config.assistantName) + '">',
      '  <div class="arix-head">',
      '    <div class="arix-head-left">',
      '      <span class="arix-dot"></span>',
      '      <div style="min-width:0;">',
      '        <p class="arix-title">' + escapeHtml(config.assistantName) + '</p>',
      '        <p class="arix-sub">' + escapeHtml(config.tagline) + '</p>',
      '      </div>',
      '    </div>',
      '    <div class="arix-head-actions">',
      '      <button type="button" class="arix-icon-btn arix-clear">Reset</button>',
      '      <button type="button" class="arix-icon-btn arix-close" aria-label="Close assistant">\\u2715</button>',
      '    </div>',
      '  </div>',
      '  <div class="arix-messages"></div>',
      '  <form class="arix-form">',
      '    <input type="text" class="arix-input" placeholder="' + escapeHtml(config.placeholder) + '" />',
      '    <button type="submit" class="arix-send">Send</button>',
      '  </form>',
      '</div>',
      '<button type="button" class="arix-launcher" aria-label="Open ' + escapeHtml(config.assistantName) + '">',
      '  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      '</button>'
    ].join('');
    shadow.appendChild(wrap);

    var panel = wrap.querySelector('.arix-panel');
    var launcher = wrap.querySelector('.arix-launcher');
    var closeBtn = wrap.querySelector('.arix-close');
    var clearBtn = wrap.querySelector('.arix-clear');
    var messagesEl = wrap.querySelector('.arix-messages');
    var form = wrap.querySelector('.arix-form');
    var input = wrap.querySelector('.arix-input');
    var sendBtn = wrap.querySelector('.arix-send');

    var history = loadHistory();
    var busy = false;

    function renderMessages() {
      messagesEl.innerHTML = '';
      var welcome = document.createElement('div');
      welcome.className = 'arix-msg assistant';
      welcome.innerHTML = formatReply(config.welcomeMessage);
      messagesEl.appendChild(welcome);

      for (var i = 0; i < history.length; i++) {
        var item = history[i];
        var el = document.createElement('div');
        el.className = 'arix-msg ' + (item.role === 'user' ? 'user' : 'assistant');
        el.innerHTML = item.role === 'user' ? escapeHtml(item.content) : formatReply(item.content);
        messagesEl.appendChild(el);
      }

      if (busy) {
        var typing = document.createElement('div');
        typing.className = 'arix-msg assistant';
        typing.textContent = 'Thinking...';
        messagesEl.appendChild(typing);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    launcher.addEventListener('click', function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        renderMessages();
        setTimeout(function () { input.focus(); }, 50);
      }
    });

    closeBtn.addEventListener('click', function () {
      panel.classList.remove('open');
    });

    clearBtn.addEventListener('click', function () {
      history = [];
      saveHistory(history);
      renderMessages();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = (input.value || '').trim();
      if (!text || busy) return;
      input.value = '';
      history.push({ role: 'user', content: text });
      saveHistory(history);
      busy = true;
      sendBtn.disabled = true;
      renderMessages();

      fetch(serverUrl + '/api/assistant/chat', {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          attrKey ? { 'X-Arix-Widget-Key': attrKey } : {}
        ),
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1).slice(-10),
          pageUrl: window.location.href,
          pageTitle: document.title,
          widgetKey: attrKey || undefined
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          var replyText = res.ok && res.data && res.data.reply
            ? res.data.reply
            : (res.data && res.data.error ? res.data.error : 'Sorry, I could not respond right now.');
          history.push({ role: 'assistant', content: replyText });
          saveHistory(history);
        })
        .catch(function () {
          history.push({ role: 'assistant', content: 'Unable to reach the AI assistant right now.' });
          saveHistory(history);
        })
        .finally(function () {
          busy = false;
          sendBtn.disabled = false;
          renderMessages();
        });
    });

    renderMessages();
  }

  fetch(serverUrl + '/api/assistant/config', {
    headers: attrKey ? { 'X-Arix-Widget-Key': attrKey } : {}
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (remote) {
      if (remote && typeof remote === 'object') {
        config.enabled = remote.enabled !== false;
        if (!attrTitle && remote.assistantName) config.assistantName = remote.assistantName;
        if (remote.tagline) config.tagline = remote.tagline;
        if (!attrWelcome && remote.welcomeMessage) config.welcomeMessage = remote.welcomeMessage;
        if (!attrPlaceholder && remote.placeholder) config.placeholder = remote.placeholder;
        if (!attrColor && remote.accentColor) config.accentColor = remote.accentColor;
        if (!attrPosition && remote.position) config.position = remote.position;
      }
      initWidget();
    })
    .catch(function () {
      initWidget();
    });
})();
`;
}
