import {uploadRoute} from '../../../../lib/auth/uploads';
import {authRoute} from '../../../../lib/auth/routes';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function route(request:Request,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;
 return action==='uploads'?uploadRoute(request):authRoute(request,action);
}
export {route as GET,route as POST,route as DELETE};
