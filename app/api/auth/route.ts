import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {databasePool} from '@/lib/database';
import {createSession,getSession,missingConfig,safeEqual,sessionCookie} from '@/lib/session';
export const runtime='nodejs';
export async function GET(){const session=await getSession();return Response.json({role:session?.role||null,missing:missingConfig()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origen no permitido'},{status:403});
 if(missingConfig().length)return Response.json({error:'El administrador debe terminar la configuración del servidor.'},{status:503});
 try{const {password,role}=await req.json();if(typeof password!=='string'||password.length>256||!['operator','admin'].includes(role))return Response.json({error:'Credenciales no válidas'},{status:400});
 const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'local';const key=createHash('sha256').update(ip).digest('hex');
 const sql=databasePool();
 const attempt=await sql.query("INSERT INTO login_attempts(key,attempts,expires_at) VALUES($1,1,NOW()+INTERVAL '10 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<NOW() THEN 1 ELSE login_attempts.attempts+1 END,expires_at=CASE WHEN login_attempts.expires_at<NOW() THEN NOW()+INTERVAL '10 minutes' ELSE login_attempts.expires_at END RETURNING attempts",[key]);
 if(attempt.rows[0].attempts>20)return Response.json({error:'Demasiados intentos. Espera 10 minutos.'},{status:429,headers:{'Retry-After':'600'}});
 const expected=role==='admin'?process.env.ADMIN_PASSWORD!:process.env.OPERATOR_PASSWORD!;if(!safeEqual(password,expected))return Response.json({error:'Contraseña incorrecta.'},{status:401});
 (await cookies()).set(sessionCookie,createSession(role),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:43200});return Response.json({ok:true,role});
 }catch{return Response.json({error:'No se pudo iniciar sesión. Comprueba la conexión y la migración de la base de datos.'},{status:503});}
}
export async function DELETE(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origen no permitido'},{status:403});(await cookies()).delete(sessionCookie);return Response.json({ok:true});}
