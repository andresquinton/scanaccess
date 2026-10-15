import {redirect} from 'next/navigation';
import {getSession} from '@/lib/session';
import AccessClient from './access-client';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{evento?:string}>}){const session=await getSession();if(!session){const event=(await searchParams).evento;redirect('/login'+(event?'?evento='+encodeURIComponent(event):''));}return <AccessClient role={session.role}/>;}
