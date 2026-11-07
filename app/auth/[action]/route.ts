import { uploadRoute } from '../../../lib/auth/uploads';
import { authRoute } from '../../../lib/auth/routes';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function route(r: Request, {params}: {params: Promise<{action:string}>}) { const action=(await params).action; return action==='uploads'?uploadRoute(r):authRoute(r,action); }
export { route as GET, route as POST, route as DELETE };
