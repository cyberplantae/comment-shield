const { app, BrowserWindow, utilityProcess, session, safeStorage, shell, dialog, Menu } = require('electron');
const { randomBytes } = require('node:crypto');
const { createServer } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { sessionToken, externalAllowed } = require('./security.cjs');
const RELEASES = 'https://github.com/cyberplantae/comment-shield/releases';
let server, window, stopping = false;
const smoke = process.env.SHIELD_SMOKE_TEST === '1' && process.env.SHIELD_TEST_MODE === '1' && Boolean(process.env.SHIELD_TEST_USER_DATA);
app.setName('Comment Shield');
if (process.env.SHIELD_TEST_USER_DATA) app.setPath('userData', process.env.SHIELD_TEST_USER_DATA);
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (window) { window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => {
    if (smoke) { console.error(error.message); app.exit(1); return; }
    dialog.showErrorBox('Your spellbook could not open', `${error.message}\nYour saved data has not been removed.`); app.quit();
  });
}
async function freePort() {
  return new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
}
async function start() {
  const dataDir = app.getPath('userData'); fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error('Unlock your operating system’s secure key storage, then try again.');
  const keyPath = path.join(dataDir, 'credential-key');
  let key;
  if (fs.existsSync(keyPath)) key = safeStorage.decryptString(fs.readFileSync(keyPath));
  else { key = randomBytes(32).toString('base64'); fs.writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 0o600 }); }
  const password = randomBytes(32).toString('base64url');
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const root = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '../desktop-server');
  if (!fs.existsSync(path.join(root, 'server.js'))) throw new Error('The desktop server is missing. Build the desktop package first.');
  // Explicit environment: never inherit development .env/API secrets into a shipped app.
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, SystemRoot: process.env.SystemRoot, TMPDIR: process.env.TMPDIR,
    NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1', PUBLIC_BASE_URL: origin,
    SHIELD_DESKTOP: '1', SHIELD_DATA_DIR: dataDir, SHIELD_MIGRATIONS_DIR: path.join(root, 'drizzle'),
    ADMIN_PASSWORD: password, TOKEN_ENCRYPTION_KEY: key, NEXT_TELEMETRY_DISABLED: '1',
    CLASSIFIER_PROVIDER: 'ollama', OLLAMA_MODEL: 'llama3.1:8b', SHIELD_TEST_MODE: process.env.SHIELD_TEST_MODE || '',
  };
  for (const name of Object.keys(env)) if (env[name] === undefined) delete env[name];
  server = utilityProcess.fork(path.join(root, 'server.js'), [], { cwd: root, env, stdio: 'pipe', serviceName: 'Comment Shield local engine' });
  server.stdout?.on('data', () => {});
  server.stderr?.on('data', data => { if (process.env.SHIELD_TEST_MODE === '1') process.stderr.write(data); });
  let exited = false;
  server.on('exit', () => { exited = true; if (!stopping) { if (smoke) { app.exit(1); return; } dialog.showErrorBox('Comment Shield stopped', 'The local engine stopped. Quit and reopen the app. Your saved settings remain on this computer.'); app.quit(); } });
  const deadline = Date.now() + 90000;
  while (true) {
    if (exited) throw new Error('The local engine could not start.');
    try { const response = await fetch(origin + '/login'); if (response.ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('The local engine took too long to start.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const ses = session.fromPartition('comment-shield-desktop');
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  const unlock = () => ses.cookies.set({ url: origin, name: 'shield_session', value: sessionToken(password), httpOnly: true, sameSite: 'lax', path: '/', expirationDate: Date.now()/1000 + 43200 });
  await unlock();
  if (smoke) {
    const response = await fetch(origin + '/desktop', { headers: { cookie: 'shield_session=' + sessionToken(password) }, redirect: 'manual' });
    const content = await response.text();
    if (response.status !== 200 || !content.includes('A ward of your own.')) throw new Error('Authenticated first-run check failed');
    fs.writeFileSync(path.join(dataDir, 'smoke-result.json'), JSON.stringify({ok:true}));
    app.quit(); return;
  }
  const renew = setInterval(() => { void unlock(); }, 3600000); renew.unref();
  window = new BrowserWindow({ width: 1180, height: 820, minWidth: 740, minHeight: 620, show: false, backgroundColor: '#14121b', title: 'Comment Shield', webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  const openExternal = url => { if (externalAllowed(url)) void shell.openExternal(url); };
  window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) { event.preventDefault(); openExternal(url); } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  await window.loadURL(origin + '/desktop');
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Comment Shield', submenu: [{ role: 'about' }, { label: 'Download updates…', click: () => shell.openExternal(RELEASES) }, { label: 'Show saved-data folder', click: () => shell.openPath(dataDir) }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
  ]));
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopping = true; server?.kill(); });
