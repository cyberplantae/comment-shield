import { cpSync, mkdirSync, existsSync, rmSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
const target = 'desktop-server';
rmSync(target, { recursive: true, force: true });
cpSync('.next/standalone', target, { recursive: true, verbatimSymlinks: true, filter: source => !/(^|[\/])\.env(?:\.|$)/.test(source) });
mkdirSync(join(target, '.next'), { recursive: true });
cpSync('.next/static', join(target, '.next/static'), { recursive: true });
if (existsSync('public')) cpSync('public', join(target, 'public'), { recursive: true });
cpSync('drizzle', join(target, 'drizzle'), { recursive: true });
// PGlite loads WASM/data dynamically, which tracing cannot always discover.
cpSync('node_modules/@electric-sql/pglite', realpathSync(join(target, 'node_modules/@electric-sql/pglite')), { recursive: true, dereference: true });
function verify(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { if (item.name === '.env' || item.name.startsWith('.env.')) throw new Error('Environment file found in desktop bundle'); if(item.isDirectory()) verify(join(dir,item.name)); } }
verify(target);
console.log('Desktop server prepared without environment files.');
