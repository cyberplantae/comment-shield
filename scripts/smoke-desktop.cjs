const { spawn } = require('node:child_process');
const { mkdtempSync, existsSync, readFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const dir = mkdtempSync(join(tmpdir(), 'shield-native-smoke-'));
const candidates = process.platform === 'darwin'
 ? ['mac-arm64/Comment Shield.app/Contents/MacOS/Comment Shield', 'mac/Comment Shield.app/Contents/MacOS/Comment Shield']
 : process.platform === 'win32' ? ['win-unpacked/Comment Shield.exe'] : ['linux-unpacked/comment-shield'];
const binary = candidates.map(p => resolve('desktop-dist', p)).find(existsSync);
if (!binary) throw new Error('Packaged executable missing');
const child = spawn(binary, [], { env: {...process.env, SHIELD_TEST_USER_DATA: dir, SHIELD_TEST_MODE:'1', SHIELD_SMOKE_TEST:'1'}, stdio:'inherit' });
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 120000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode=1; });
child.on('exit', code => {
 clearTimeout(timer);
 const marker = join(dir, 'smoke-result.json');
 const passed = code === 0 && existsSync(marker) && JSON.parse(readFileSync(marker,'utf8')).ok;
 console.log(passed ? 'Packaged engine, secure storage, owner session and database passed.' : 'Packaged startup failed.');
 process.exitCode = passed ? 0 : 1;
 rmSync(dir,{recursive:true,force:true});
});
