import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import Tracker from '../components/tracker';
import {resolveAccount} from '../lib/runtime';
export const dynamic='force-dynamic';
export default async function Home(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.DATABASE_URL) redirect('/login');
 let account;
 try{account=await resolveAccount!();}catch{redirect('/login');}
 if(!account && !(await cookies()).get('orbite_parent')) redirect('/login');
 return <Tracker/>;
}
