import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(r:Request){return NextResponse.redirect(new URL('/login',r.url),{status:303,headers:{'Cache-Control':'no-store'}});}
