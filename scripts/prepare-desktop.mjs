import { cpSync, mkdirSync, existsSync, rmSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';
const target = 'desktop-server';
rmSync(target, { recursive: true, force: true });
const allowed = source => !/(^|[\\/])\.env(?:\.|$)/.test(source);
cpSync('.next/standalone', target, { recursive: true, filter: source => allowed(source) && basename(source) !== 'node_modules' });
// Flatten the traced pnpm packages: Windows junctions otherwise retain build-machine paths.
// Fail explicitly on conflicting versions instead of silently choosing one.
const versions = new Map();
function copyPackage(source, name) {
 const manifest=join(source,'package.json');
 if(!existsSync(manifest)) return;
 const version=JSON.parse(readFileSync(manifest,'utf8')).version;
 if(versions.has(name)) { if(versions.get(name)!==version) throw new Error(`Conflicting traced versions of ${name}`); return; }
 versions.set(name,version);
 cpSync(source,join(target,'node_modules',name),{recursive:true,dereference:true,filter:allowed});
}
function collect(dir) {
 for(const entry of readdirSync(dir,{withFileTypes:true})) {
  if(entry.name.startsWith('.')) continue;
  const source=join(dir,entry.name);
  if(entry.name.startsWith('@')) for(const sub of readdirSync(source)) copyPackage(join(source,sub),`${entry.name}/${sub}`);
  else copyPackage(source,entry.name);
 }
}
const traced='.next/standalone/node_modules';
const store=join(traced,'.pnpm');
if(existsSync(store)) for(const entry of readdirSync(store)) {const dir=join(store,entry,'node_modules');if(existsSync(dir)) collect(dir);}
collect(traced);
mkdirSync(join(target,'.next'),{recursive:true});
cpSync('.next/static',join(target,'.next/static'),{recursive:true});
if(existsSync('public')) cpSync('public',join(target,'public'),{recursive:true});
cpSync('drizzle',join(target,'drizzle'),{recursive:true});
cpSync(realpathSync('node_modules/@electric-sql/pglite'),join(target,'node_modules/@electric-sql/pglite'),{recursive:true,dereference:true});
function verify(dir) {for(const item of readdirSync(dir,{withFileTypes:true})) {if(!allowed(item.name)) throw new Error('Environment file in desktop bundle');if(item.isSymbolicLink()) throw new Error('Non-portable symlink in desktop bundle');if(item.isDirectory())verify(join(dir,item.name));}}
verify(target);
console.log(`Prepared portable desktop server with ${versions.size} runtime packages and no environment files.`);
