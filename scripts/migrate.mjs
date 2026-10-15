import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Configura DATABASE_URL antes de ejecutar la migración.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='disable'?false:{rejectUnauthorized:true,...process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{} }});
try{await client.connect();await client.query('BEGIN');await client.query(await readFile(new URL('../db/postgres/001_initial.sql',import.meta.url),'utf8'));await client.query('COMMIT');console.log('Esquema PostgreSQL preparado. No se han eliminado datos.');}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('No se pudo aplicar la migración:',e.code||'revisa conexión y certificado');process.exitCode=1;}finally{await client.end();}
