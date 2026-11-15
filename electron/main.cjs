const { app, BrowserWindow, shell } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
let serverProcess = null;
let mainWindow = null;

function findFreePort(preferred = 43120) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : 43121;
        fallback.close(() => resolve(port));
      });
    });
    tester.once('listening', () => {
      tester.close(() => resolve(preferred));
    });
    tester.listen(preferred, '127.0.0.1');
  });
}

function waitForHealth(port, timeoutMs = 25000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/health`,
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        }
      );
      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Arix local engine timed out starting.'));
        return;
      }
      setTimeout(check, 250);
    };

    check();
  });
}

function resolveEnvFile() {
  const candidates = [
    path.join(ROOT_DIR, '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(app.getPath('userData'), '.env'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

function startLocalBackend(port) {
  const tsxCli = path.join(ROOT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const dataDir = app.isPackaged ? app.getPath('userData') : ROOT_DIR;
  const envFile = resolveEnvFile();

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    ARIX_DATA_DIR: dataDir,
    ...(envFile ? { ARIX_ENV_FILE: envFile } : {}),
  };

  if (fs.existsSync(tsxCli)) {
    // Run via Electron's embedded Node runtime (safe with spaces in Windows paths)
    serverProcess = spawn(process.execPath, [tsxCli, 'server.ts'], {
      cwd: ROOT_DIR,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: 'pipe',
    });
  } else {
    serverProcess = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', 'server.ts'],
      {
        cwd: ROOT_DIR,
        shell: process.platform === 'win32',
        env,
        stdio: 'pipe',
      }
    );
  }

  serverProcess.stdout?.on('data', (d) => {
    process.stdout.write(`[Arix Engine] ${d}`);
  });
  serverProcess.stderr?.on('data', (d) => {
    process.stderr.write(`[Arix Engine] ${d}`);
  });
}

function stopLocalBackend() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === 'win32' && serverProcess.pid) {
      execSync(`taskkill /pid ${serverProcess.pid} /T /F`, {
        stdio: 'ignore',
      });
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch {
    // Ignore if already exited
  }
}

async function createAppWindow() {
  const port = await findFreePort(43120);
  startLocalBackend(port);
  await waitForHealth(port);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: 'Arix — Personal Autonomous AI',
    backgroundColor: '#060E1F',
    autoHideMenuBar: true,
    icon: path.join(ROOT_DIR, 'public', 'pwa-512x512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.webContents.session.clearCache();
  await mainWindow.webContents.session.clearStorageData({
    storages: ['serviceworkers', 'cachestorage'],
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.setAppUserModelId('com.arix.personal.ai');

app.whenReady().then(createAppWindow).catch((err) => {
  console.error('Failed to launch Arix Desktop App:', err);
  stopLocalBackend();
  app.quit();
});

app.on('window-all-closed', () => {
  stopLocalBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopLocalBackend();
});
