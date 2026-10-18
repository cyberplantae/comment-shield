const fs = require('node:fs');
const path = require('node:path');
function prepareUpgrade(dir, version) {
 const marker = path.join(dir,'installed-version');
 const previous = fs.existsSync(marker) ? fs.readFileSync(marker,'utf8').trim() : null;
 if (previous === version) return;
 const parts = value => value.split('.').map(Number);
 if (previous) {
  const a=parts(previous), b=parts(version);
  for(let i=0;i<3;i++) { if(a[i]>b[i]) throw new Error('This spellbook was opened with a newer version. Download that version or a newer one to keep your data safe.'); if(a[i]<b[i]) break; }
 }
 if(fs.existsSync(path.join(dir,'database'))) {
  const backup=path.join(dir,'backups',`${Date.now()}-before-${version}`);
  fs.mkdirSync(backup,{recursive:true,mode:0o700});
  fs.cpSync(path.join(dir,'database'),path.join(backup,'database'),{recursive:true});
  const key=path.join(dir,'credential-key');
  if(fs.existsSync(key)) fs.copyFileSync(key,path.join(backup,'credential-key'));
  fs.writeFileSync(path.join(backup,'README.txt'),'Automatic backup before upgrade. Quit Comment Shield before restoring. Credentials require the original operating-system keychain.\n',{mode:0o600});
 }
}
function finishUpgrade(dir,version) { fs.writeFileSync(path.join(dir,'installed-version'),version,{mode:0o600}); }
module.exports={prepareUpgrade,finishUpgrade};
