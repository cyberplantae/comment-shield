const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { sessionToken, externalAllowed } = require('./security.cjs');
test('desktop session matches owner signature and twelve-hour expiry', () => {
 const secret = 'test-owner-secret'; const token = sessionToken(secret, 1000000);
 const expiry = '44200';
 assert.equal(token, `${expiry}.${createHmac('sha256', secret).update(`owner:${expiry}`).digest('hex')}`);
 assert.notEqual(sessionToken('another-secret', 1000000), token);
});
test('external navigation rejects local protocols and lookalike hosts', () => {
 for(const url of ['file:///etc/passwd','http://github.com','https://github.com.evil.test','https://user:secret@github.com','javascript:alert(1)','https://localhost']) assert.equal(externalAllowed(url), false, url);
 assert.equal(externalAllowed('https://github.com/cyberplantae/comment-shield/releases'),true);
});
test('embedded migrations survive reopening without losing saved settings', async () => {
 const { mkdtemp, rm } = require('node:fs/promises'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
 const { PGlite } = require('@electric-sql/pglite'); const { drizzle } = require('drizzle-orm/pglite'); const { migrate } = require('drizzle-orm/pglite/migrator');
 const dir = await mkdtemp(join(tmpdir(),'shield-db-test-')); let db;
 try {
 db = new PGlite(dir); await migrate(drizzle(db), {migrationsFolder:'drizzle'});
 await db.query("INSERT INTO app_settings (id, desktop_enabled) VALUES ('singleton', true)");
 await db.close(); db = new PGlite(dir); await migrate(drizzle(db), {migrationsFolder:'drizzle'});
 const result = await db.query("SELECT desktop_enabled FROM app_settings WHERE id='singleton'");
 assert.equal(result.rows[0].desktop_enabled,true);
 } finally { if(db) await db.close(); await rm(dir,{recursive:true,force:true}); }
});
test('upgrades back up existing data once and reject downgrades', async () => {
 const fs = require('node:fs'); const {tmpdir}=require('node:os'); const {join}=require('node:path');
 const {prepareUpgrade,finishUpgrade}=require('./upgrades.cjs');
 const dir=fs.mkdtempSync(join(tmpdir(),'shield-upgrade-'));
 try {
 fs.mkdirSync(join(dir,'database')); fs.writeFileSync(join(dir,'database','fixture'),'saved preferences');
 finishUpgrade(dir,'0.1.0'); prepareUpgrade(dir,'0.1.1'); finishUpgrade(dir,'0.1.1');
 const backups=fs.readdirSync(join(dir,'backups'));
 assert.equal(backups.length,1); assert.equal(fs.readFileSync(join(dir,'backups',backups[0],'database','fixture'),'utf8'),'saved preferences');
 prepareUpgrade(dir,'0.1.1'); assert.equal(fs.readdirSync(join(dir,'backups')).length,1);
 assert.throws(()=>prepareUpgrade(dir,'0.1.0'),/newer version/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
