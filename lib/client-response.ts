export async function readJsonResponse(response:Response):Promise<any>{
 let result:any;
 try{result=await response.json();}catch{throw new Error('Le serveur n’a pas répondu correctement. Votre saisie est conservée ; réessayez.');}
 if(!response.ok)throw new Error(typeof result?.error==='string'?result.error:'L’action n’a pas pu être terminée. Réessayez.');
 return result;
}
