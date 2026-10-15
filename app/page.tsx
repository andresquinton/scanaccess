import {redirect} from 'next/navigation';
import {getSession} from '@/lib/session';
import AccessClient from './access-client';
export const dynamic='force-dynamic';
export default async function Page(){const session=await getSession();if(!session)redirect('/login');return <AccessClient role={session.role}/>;}
