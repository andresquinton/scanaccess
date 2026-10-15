import {authorize} from '@/lib/session';
import {database} from '@/lib/database';
export async function POST(req:Request){const denied=await authorize(req,false);if(denied)return denied;try{const {event,code,device}=await req.json() as any;if(typeof event!=='string'||typeof code!=='string'||!/^\d{1,80}$|^S\d{1,80}E$/.test(code))return Response.json({error:'Código no válido'}, {status:400});
// Printed badges encode S + numeric identifier + E (Code 39).
const numeric=code.match(/^S(\d+)E$/)?.[1]||code;
const now=new Date().toISOString();const p=await database.prepare('UPDATE people SET arrived=?,device=?,revision=revision+1 WHERE event=? AND code=? AND arrived IS NULL RETURNING name,code,arrived,device,revision').bind(now,String(device||'Acceso').slice(0,60),event,numeric).first();if(p)return Response.json({status:'ok',person:p});const old=await database.prepare('SELECT name,code,arrived FROM people WHERE event=? AND code=?').bind(event,numeric).first();return Response.json(old?{status:'duplicate',person:old}:{status:'unknown'});}catch{return Response.json({error:'No se ha confirmado la entrada. Comprueba la conexión y vuelve a escanear.'},{status:503});}}
