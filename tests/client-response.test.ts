import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readJsonResponse} from '../lib/client-response.ts';
test('Une réponse HTML ne remonte pas une erreur de syntaxe Safari au formulaire',async()=>{
 const r=new Response('<html>Method not allowed</html>',{status:405,headers:{'content-type':'text/html'}});
 await assert.rejects(readJsonResponse(r),/Votre saisie est conservée/);
});
test('Les erreurs de validation et les succès JSON sont conservés',async()=>{
 await assert.rejects(readJsonResponse(Response.json({error:'12 caractères minimum.'},{status:400})),/12 caractères/);
 assert.deepEqual(await readJsonResponse(Response.json({ok:true})),{ok:true});
});
