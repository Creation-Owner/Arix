import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');
const viteBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
);

console.log('\n=== Arix Windows / Desktop App Installer ===\n');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('Created .env from .env.example.');
}

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  if (envText.includes('MY_GEMINI_API_KEY')) {
    console.log(
      'NOTE: Put your real GEMINI_API_KEY inside .env (and set ARIX_COMPUTER_ROOT if desired) before using AI chat.\n'
    );
  }
}

if (!fs.existsSync(viteBin)) {
  console.log('0/3 Installing base workspace packages...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
}

console.log('1/3 Installing Electron desktop runtime...');
execSync('npm install -D electron electron-builder --legacy-peer-deps', {
  stdio: 'inherit',
});

console.log('\n2/3 Building Arix production app...');
execSync('npm run build', { stdio: 'inherit' });

if (process.platform === 'win32') {
  const batPath = path.join(root, 'Launch-Arix.bat');
  const batContent = `@echo off\r\ncd /d "%~dp0"\r\nnpx electron electron/main.cjs\r\n`;
  fs.writeFileSync(batPath, batContent, 'utf8');
  console.log(`\nCreated Windows double-click launcher: ${batPath}`);
}

console.log('\n3/3 Launching Arix Standalone Desktop App...');
execSync('npx electron electron/main.cjs', { stdio: 'inherit' });
