import {env} from 'cloudflare:workers';
import {connectorsForRequest} from '@/lib/connectors';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
const connector='connector_5f3c8c41a1e54ad7a76272c89e2554fa';
const spreadsheet='1DV4dBOpA3dProCWhvjq_JbqRonr0_Nc_zkDoBLkHyeE';
const event='summit-google-sheet';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
function unpack(result:any):any {if(result.structuredContent!==undefined)return result.structuredContent;for(const c of result.content||[]){if(c.type==='text'){try{return JSON.parse(c.text);}catch{}}}throw Error('Google no devolvió datos legibles.');}
export async function POST(req:Request){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return reply({error:'Origen no permitido'},403);
 if(!await getChatGPTUser())return reply({error:'Inicia sesión para conectar Google Sheets.',status:'reauthentication_required',connect:chatGPTSignInPath('/?evento='+event)},401);
 const body=await req.json() as any;const flush=body.flush===true;
 const lock=String(Date.now()+90000)+':'+crypto.randomUUID();
 if(flush){const claimed=await env.DB.prepare("INSERT INTO sheet_sync(code,synced) VALUES('__lease',?) ON CONFLICT(code) DO UPDATE SET synced=excluded.synced WHERE CAST(substr(sheet_sync.synced,1,13) AS INTEGER)<? RETURNING synced").bind(lock,Date.now()).first<{synced:string}>();if(claimed?.synced!==lock)return reply({id:event,flushed:false,busy:true});}
 try {
 const client=connectorsForRequest();
 const read=await client.invoke(connector,'get_spreadsheet_range',{spreadsheet_id:spreadsheet,sheet_name:'Worksheet',range:'A1:E1000',value_render_option:'FORMATTED_VALUE'});
 if(read.status!=='success')return reply({...read,error:read.message,connect:read.status==='reauthentication_required'?chatGPTSignInPath('/?evento='+event):undefined},502);
 try{
 const data=unpack(read.result);const rows:any[][]=data.values;
 if(!Array.isArray(rows)||rows[0]?.[0]?.toLowerCase()!=='nombre'||rows[0]?.[1]?.toLowerCase()!=='cod')throw Error('La hoja debe conservar nombre en A y cod en B.');
 const expected=['Asistencia','Hora de entrada (UTC)','Puesto'];if(expected.some((h,i)=>rows[0]?.[i+2]!==h))throw Error('Revisa las cabeceras de las columnas C–E de Google Sheets.');
 const roster:Array<{name:string;code:string;row:number;arrived:string|null;device:string|null}>=[];const seen=new Set();let missing=0;
 for(let i=1;i<rows.length;i++){const [rawName,rawCode,status,stamp,device]=rows[i];const name=String(rawName||'').trim(),code=String(rawCode||'').trim();if(!name&&!code)continue;if(name&&!code){missing++;continue;}if(!name||!/^\d{1,80}$/.test(code)||seen.has(code))throw Error('Código inválido o repetido en la fila '+(i+1));seen.add(code);const arrived=status==='Sí'&&stamp&&!Number.isNaN(Date.parse(stamp))?new Date(stamp).toISOString():null;roster.push({name,code,row:i,arrived,device:arrived?String(device||'Google Sheets'):null});}
 await env.DB.prepare('INSERT OR IGNORE INTO events(id,name,created) VALUES(?,?,?)').bind(event,'Asistentes Summit 2026',new Date().toISOString()).run();
 for(let i=0;i<roster.length;i+=75)await env.DB.batch(roster.slice(i,i+75).map(p=>env.DB.prepare('INSERT INTO people(event,code,name,arrived,device) VALUES(?,?,?,?,?) ON CONFLICT(event,code) DO UPDATE SET name=excluded.name, arrived=COALESCE(people.arrived,excluded.arrived), device=COALESCE(people.device,excluded.device)').bind(event,p.code,p.name,p.arrived,p.device)));
 // Never erase historical check-ins when the source roster changes.
 const current=await env.DB.prepare('SELECT code FROM people WHERE event=? AND arrived IS NULL').bind(event).all<{code:string}>();const removed=current.results.filter(p=>!seen.has(p.code));for(let i=0;i<removed.length;i+=75)await env.DB.batch(removed.slice(i,i+75).map(p=>env.DB.prepare('DELETE FROM people WHERE event=? AND code=? AND arrived IS NULL').bind(event,p.code)));
 const entered=await env.DB.prepare('SELECT p.code,p.arrived,p.device FROM people p WHERE event=? AND arrived IS NOT NULL').bind(event).all<{code:string;arrived:string;device:string}>();
 const byCode=new Map(roster.map(p=>[p.code,p]));let pending=0;const updates:any[]=[];
 for(const p of entered.results){const source=byCode.get(p.code);if(!source){pending++;continue;}const r=rows[source.row];if(r[2]==='Sí'&&r[3]===p.arrived&&String(r[4]||'')===p.device)continue;pending++;updates.push({updateCells:{range:{sheetId:1799967749,startRowIndex:source.row,endRowIndex:source.row+1,startColumnIndex:2,endColumnIndex:5},rows:[{values:['Sí',p.arrived,p.device||'Acceso'].map(s=>({userEnteredValue:{stringValue:s}}))}],fields:'userEnteredValue'}});}
 if(flush&&updates.length){const result=await client.invoke(connector,'batch_update_spreadsheet',{spreadsheet_id:spreadsheet,requests:updates.slice(0,100)});if(result.status!=='success')return reply({...result,error:result.message,pending,missing,id:event,connect:result.status==='reauthentication_required'?chatGPTSignInPath('/?evento='+event):undefined},502);pending-=Math.min(updates.length,100);}
 return reply({id:event,missing,pending,loaded:roster.length,readAt:new Date().toISOString(),flushed:flush});
 }catch(e:any){return reply({error:e.message||'No se pudo sincronizar. La asistencia permanece guardada.'},500);}
 }finally{if(flush)await env.DB.prepare("DELETE FROM sheet_sync WHERE code='__lease' AND synced=?").bind(lock).run();}
}
