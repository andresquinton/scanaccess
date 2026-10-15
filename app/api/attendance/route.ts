import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origen no permitido'},403);
 if(!await getChatGPTUser())return json({error:'Inicia sesión para registrar o corregir asistencias.'},401);
 try{
 const {event,code,attending,revision,device}=await req.json() as any;
 if(typeof event!=='string'||typeof code!=='string'||typeof attending!=='boolean'||!Number.isSafeInteger(revision)||revision<0)return json({error:'Datos no válidos'},400);
 const person=await env.DB.prepare('UPDATE people SET arrived=?,device=?,revision=revision+1 WHERE event=? AND code=? AND revision=? RETURNING *').bind(attending?new Date().toISOString():null,attending?String(device||'Registro manual').slice(0,60):null,event,code,revision).first();
 if(person)return json({person});
 const existing=await env.DB.prepare('SELECT code FROM people WHERE event=? AND code=?').bind(event,code).first();
 return json({error:existing?'Otra persona ha actualizado esta asistencia. Revisa su estado antes de volver a cambiarla.':'Persona no encontrada.'},existing?409:404);
 }catch{return json({error:'No se pudo guardar el cambio. Comprueba la conexión.'},503);}
}
