import {spawnSync} from 'node:child_process';
// Production Git deployments apply versioned migrations before building.
// Preview builds never modify the production database.
if(process.env.VERCEL_ENV==='production'&&process.env.DATABASE_URL){
 const result=spawnSync(process.execPath,['scripts/migrate.mjs'],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
const build=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{stdio:'inherit'});
process.exit(build.status||0);
