import {redirect} from 'next/navigation';
import {invitationFromCookie} from '../../../lib/auth/invitations';
import ParentActivation from '../../../components/parent-activation';
export const dynamic='force-dynamic';
export default async function Activate(){
 if(!await invitationFromCookie())redirect('/login?error=invitation');
 return <ParentActivation/>;
}
