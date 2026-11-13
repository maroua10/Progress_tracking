import { redirect } from 'next/navigation';
import LoginForm from '../../../components/login-form';
import {resolveAccount} from '../../../lib/runtime';
export const dynamic='force-dynamic';
export default async function Password() {
 const actor=await resolveAccount!();if(!actor)redirect('/login?error=expired');if(actor.role!=='teacher')redirect('/');
 return <LoginForm configured passwordOnly/>;
}
