import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const dir=new URL('./.runtime/',import.meta.url);await mkdir(dir,{recursive:true});
for(const name of ['database','session']){let input=await readFile(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');input=input.replace("'next/headers'","'next/headers.js'");const js=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;await writeFile(new URL(name+'.mjs',dir),js);}
const {postgresQuery}=await import('./.runtime/database.mjs');const {createSession,verifySession}=await import('./.runtime/session.mjs');
after(()=>rm(dir,{recursive:true,force:true}));
const db=new PGlite();await db.exec(await readFile(new URL('../db/postgres/001_initial.sql',import.meta.url),'utf8'));after(()=>db.close());
const sources={};for(const path of ['scan','attendance','sheets'])sources[path]=await readFile(new URL('../app/api/'+path+'/route.ts',import.meta.url),'utf8');
function query(path,start){const matches=[...sources[path].matchAll(/prepare\('([^']+)'\)/g)].map(m=>m[1]);const q=matches.find(q=>q.startsWith(start));assert.ok(q,'Query exists: '+start);return postgresQuery(q);}
test('signed sessions reject tampering and password rotation',()=>{process.env.SESSION_SECRET='test-only-secret-32-characters-long-x';process.env.OPERATOR_PASSWORD='test-operator-password';process.env.ADMIN_PASSWORD='test-admin-password';const token=createSession('operator');assert.equal(verifySession(token).role,'operator');assert.equal(verifySession(token+'x'),null);const body=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));body.role='admin';assert.equal(verifySession(Buffer.from(JSON.stringify(body)).toString('base64url')+'.'+token.split('.')[1]),null);process.env.OPERATOR_PASSWORD='changed-password';assert.equal(verifySession(token),null);});
test('PostgreSQL: duplicate scans, stale corrections, clearing and stale sheet reconciliation',async()=>{
 await db.query('INSERT INTO events VALUES($1,$2,$3)',['test','Test','2026-01-01']);await db.query('INSERT INTO people(event,code,name) VALUES($1,$2,$3)',['test','35060','QA']);
 const scan=query('scan','UPDATE people');const replies=await Promise.all(Array.from({length:12},()=>db.query(scan,['2026-10-15T10:00:00.000Z','Gate','test','35060'])));assert.equal(replies.filter(r=>r.rows.length).length,1);
 const correction=query('attendance','UPDATE people');assert.equal((await db.query(correction,['2026-10-15T10:30:00.000Z','Operator','test','35060',1,false])).rows.length,0);assert.equal((await db.query(correction,[null,null,'test','35060',0,true])).rows.length,0);assert.equal((await db.query(correction,[null,null,'test','35060',1,true])).rows[0].revision,2);
 const upsert=query('sheets','INSERT INTO people');await db.query(upsert,['test','35060','QA renamed','2026-10-15T10:00:00.000Z','Old sheet']);const row=(await db.query('SELECT * FROM people WHERE code=$1',['35060'])).rows[0];assert.equal(row.arrived,null);assert.equal(row.device,null);assert.equal(row.name,'QA renamed');
 assert.equal((await db.query(scan,['2026-10-15T11:00:00.000Z','Gate','test','35060'])).rows.length,1);
 await db.query(upsert,['test','guest:00000000-0000-0000-0000-000000000000','Invitada',null,null]);assert.equal((await db.query(correction,['2026-10-15T11:00:00.000Z','Manual','test','guest:00000000-0000-0000-0000-000000000000',0,false])).rows.length,1);
});
test('PostgreSQL lease uses bigint, admits one synchronizer and recovers expired leases',async()=>{const sql=postgresQuery("INSERT INTO sheet_sync(code,synced) VALUES('__lease',?) ON CONFLICT(code) DO UPDATE SET synced=excluded.synced WHERE CAST(substr(sheet_sync.synced,1,13) AS INTEGER)<? RETURNING synced");const now=Date.now();assert.equal((await db.query(sql,[String(now+90000)+':one',now])).rows.length,1);assert.equal((await db.query(sql,[String(now+90000)+':two',now])).rows.length,0);assert.equal((await db.query(sql,[String(now+190000)+':three',now+100000])).rows.length,1);});
test('all tables keep RLS enabled',async()=>{const rows=(await db.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('events','people','sheet_sync','login_attempts')")).rows;assert.equal(rows.length,4);assert.ok(rows.every(r=>r.relrowsecurity));});
