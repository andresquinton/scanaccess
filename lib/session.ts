import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
export type Role='operator'|'admin';
export type Session={role:Role;expires:number;version:string};
export const sessionCookie='scanaccess_session';
export function missingConfig(){return ['DATABASE_URL','SESSION_SECRET','OPERATOR_PASSWORD','ADMIN_PASSWORD'].filter(k=>!process.env[k]||((k==='SESSION_SECRET')&&process.env[k]!.length<32)||((k==='OPERATOR_PASSWORD'||k==='ADMIN_PASSWORD')&&process.env[k]!.length<12));}
function version(){return createHash('sha256').update((process.env.OPERATOR_PASSWORD||'')+'\0'+(process.env.ADMIN_PASSWORD||'')).digest('hex').slice(0,24);}
function signature(body:string){const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw Error('Configura SESSION_SECRET con al menos 32 caracteres.');return createHmac('sha256',secret).update(body).digest('base64url');}
export function safeEqual(a:string,b:string){const aa=createHash('sha256').update(a).digest(),bb=createHash('sha256').update(b).digest();return timingSafeEqual(aa,bb);}
export function createSession(role:Role){const body=Buffer.from(JSON.stringify({role,expires:Date.now()+12*60*60*1000,version:version()})).toString('base64url');return body+'.'+signature(body);}
export function verifySession(token:string|undefined):Session|null{try{if(!token)return null;const parts=token.split('.');if(parts.length!==2||!safeEqual(signature(parts[0]),parts[1]))return null;const s=JSON.parse(Buffer.from(parts[0],'base64url').toString());return (s.role==='admin'||s.role==='operator')&&Number.isFinite(s.expires)&&s.expires>Date.now()&&s.version===version()?s:null;}catch{return null;}}
export async function getSession(){return verifySession((await cookies()).get(sessionCookie)?.value);}
export async function authorize(req:Request,admin=false){if(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origen no permitido'},{status:403});const session=await getSession();if(!session)return Response.json({error:'Inicia sesión para continuar.',connect:'/login'},{status:401});if(admin&&session.role!=='admin')return Response.json({error:'Esta acción requiere acceso de administrador.'},{status:403});return null;}
