import { redirect } from 'next/navigation';
import LoginForm from '../../../components/login-form';
import {resolveAccount} from '../../../lib/runtime';
export const dynamic='force-dynamic';
export default async function Password() {
 if(!await resolveAccount!()) redirect('/login?error=expired');
 return <LoginForm configured passwordOnly/>;
}
