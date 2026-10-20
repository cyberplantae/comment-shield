const { spawn } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { PGlite } = require('@electric-sql/pglite');

const candidates = process.platform === 'darwin'
 ? ['mac-arm64/Comment Shield.app/Contents/MacOS/Comment Shield', 'mac/Comment Shield.app/Contents/MacOS/Comment Shield']
 : process.platform === 'win32' ? ['win-unpacked/Comment Shield.exe'] : ['linux-unpacked/comment-shield'];
// An explicit executable also lets maintainers check an installed release.
const binary = process.argv[2] ? resolve(process.argv[2]) : candidates.map(p => resolve('desktop-dist', p)).find(fs.existsSync);
if (!binary || !fs.existsSync(binary)) throw new Error('Packaged executable missing');
const dir = fs.mkdtempSync(join(tmpdir(), 'shield-native-smoke-'));

async function launch() {
 const marker = join(dir, 'smoke-result.json');
 fs.rmSync(marker, {force:true});
 await new Promise((resolve, reject) => {
  const child = spawn(binary, [], { env: {...process.env, SHIELD_TEST_USER_DATA:dir, SHIELD_TEST_MODE:'1', SHIELD_SMOKE_TEST:'1'}, stdio:'inherit' });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('close', code => {
   clearTimeout(timer);
   if (timedOut || code !== 0) reject(new Error(`Packaged startup failed (${timedOut ? 'timeout' : code})`));
   else resolve();
  });
 });
 assert.ok(fs.existsSync(marker), 'Fresh startup result is required');
 assert.equal(JSON.parse(fs.readFileSync(marker,'utf8')).ok, true);
}
async function withDatabase(callback, folder = join(dir,'database')) {
 const db = new PGlite(folder);
 try { await callback(db); } finally { await db.close(); }
}
async function verifySettings(db) {
 const {rows} = await db.query("SELECT provider, model, desktop_enabled FROM app_settings WHERE id='singleton'");
 assert.deepEqual(rows, [{provider:'ollama', model:'qwen3:4b', desktop_enabled:false}]);
}
async function main() {
 try {
  await launch();
  const key = fs.readFileSync(join(dir,'credential-key'));
  const version = fs.readFileSync(join(dir,'installed-version'),'utf8');
  await withDatabase(db => db.query("INSERT INTO app_settings (id, provider, model, desktop_enabled) VALUES ('singleton','ollama','qwen3:4b',false) ON CONFLICT (id) DO UPDATE SET provider='ollama', model='qwen3:4b', desktop_enabled=false"));
  await launch();
  assert.deepEqual(fs.readFileSync(join(dir,'credential-key')), key, 'Restart must reuse the encrypted credential key');
  await withDatabase(verifySettings);
  assert.ok(!fs.existsSync(join(dir,'backups')), 'Same-version restart must not create an upgrade backup');
  // Exercise the upgrade path on a real migrated database. This is a simulated
  // prior version, not a claim of compatibility with every historic release.
  fs.writeFileSync(join(dir,'installed-version'),'0.0.0');
  await launch();
  assert.equal(fs.readFileSync(join(dir,'installed-version'),'utf8'),version);
  assert.deepEqual(fs.readFileSync(join(dir,'credential-key')),key);
  await withDatabase(verifySettings);
  const backups = fs.readdirSync(join(dir,'backups'));
  assert.equal(backups.length,1);
  const backup = join(dir,'backups',backups[0]);
  assert.deepEqual(fs.readFileSync(join(backup,'credential-key')),key);
  await withDatabase(verifySettings,join(backup,'database'));
  console.log('Packaged startup, secure key reuse, saved settings after restart, and readable upgrade backup passed.');
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
