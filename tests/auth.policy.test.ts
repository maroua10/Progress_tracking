import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalEmail,validEmail,strongPassword,permitsRole,safeNext} from '../lib/auth/policy.ts';
test('Un choix dans le formulaire ne donne jamais le rôle professeur',()=>{
 const parent={role:'parent',studentId:'eleve',userId:'invited',viewerKey:'account:x'};
 assert.equal(permitsRole(parent,'teacher'),false);assert.equal(permitsRole(parent,'parent'),true);
 assert.equal(permitsRole(null,'teacher'),false);assert.equal(permitsRole(parent,'admin'),false);
});
test('Adresses normalisées et mots de passe de 12 à 128 caractères',()=>{
 assert.equal(normalEmail(' Parent@exemple.fr '),'parent@exemple.fr');
 assert.equal(validEmail('parent@exemple.fr'),true);assert.equal(validEmail('parent\n@exemple.fr'),false);
 assert.equal(strongPassword('court'),false);assert.equal(strongPassword('Une phrase privée 2026'),true);assert.equal(strongPassword('x'.repeat(129)),false);
});
test('Les retours de connexion ne permettent pas de redirection externe',()=>{
 for(const value of ['https://evil.test','//evil.test','/auth/password?next=//evil.test',null])assert.equal(safeNext(value),'/');
 assert.equal(safeNext('/auth/password'),'/auth/password');
});
