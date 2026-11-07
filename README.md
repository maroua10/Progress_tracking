# Repère

Application de suivi de cours de mathématiques : séances, bilans PDF, chapitres, compétences et consultation parent en lecture seule. Interface en français, adaptée au mobile.

## Architecture

Next.js 16 / React 19, PostgreSQL Supabase, Supabase Auth (mot de passe et Google), Supabase Storage privé. Déploiement prévu sur Vercel. Les autorisations sont vérifiées côté serveur sur les données et les PDF. Aucune donnée réelle ni aucun secret n’est inclus dans ce dépôt.

Le professeur est autorisé par une commande administrateur, jamais par un choix de rôle dans un formulaire public. Il peut générer un lien d’invitation parent, le transmettre une seule fois et révoquer les accès. Le parent choisit son adresse et son mot de passe, confirme son adresse, ou utilise Google. Une invitation active un seul compte et expire après 30 jours. Les brouillons et notes privées restent réservés au professeur.

## Lancement

Node.js 22.13+ (22 LTS recommandé).

```sh
npm ci
cp .env.example .env.local
# Renseigner les variables Supabase, DATABASE_URL et APP_URL.
npm run db:migrate
npm run auth:teacher
npm run dev
```

Ouvrir http://localhost:3000. `auth:teacher` nécessite `TEACHER_EMAIL` et envoie au professeur un e-mail de création de mot de passe. Le professeur peut ensuite initialiser le suivi de l’élève depuis l’application. Ne pas initialiser un suivi vide avant d’importer un historique existant.

## Configuration externe indispensable

1. Créer un projet Supabase. Copier son URL, sa clé publique et sa clé serveur dans les variables de `.env.example`. `DATABASE_URL` doit être la connexion PostgreSQL du propriétaire, de préférence le transaction pooler port 6543 pour Vercel. Les requêtes préparées persistantes sont désactivées pour ce pooler.
2. Exécuter `npm run db:migrate`. Les migrations créent les tables, activent RLS, retirent l’accès direct aux rôles navigateur et créent le bucket privé `repere-private`. Le serveur utilise la connexion PostgreSQL privilégiée ; ne jamais la mettre dans une variable `NEXT_PUBLIC_`.
3. Dans Supabase Auth, activer la confirmation des adresses e-mail et configurer un SMTP de production. Le SMTP de test Supabase ne suffit pas pour inviter librement un parent extérieur. Régler Site URL sur l’origine de production (`APP_URL`) et autoriser précisément les callbacks de développement et de production.
4. Copier les modèles HTML de `supabase/templates/` dans les modèles Supabase « Invite user », « Reset password » et « Confirm signup ». Le modèle signup conserve le paramètre de revendication de l’invitation pour permettre la confirmation sur un autre appareil. Les modèles utilisent un jeton à usage unique vérifié côté serveur.
5. Pour Google : créer un client OAuth Web dans Google Cloud, reporter ID et secret dans le fournisseur Google de Supabase et autoriser l’URL de callback indiquée par Supabase. Aucune clé Google n’est exposée dans l’application. Les comptes Google non invités n’obtiennent pas accès aux données.

Ces services doivent être réellement configurés : sans eux, la page de connexion affiche un état de configuration manquante et aucun faux compte n’est activé.

## Vercel

Importer `maroua10/Progress_tracking`, répertoire racine du dépôt, preset Next.js, Node.js 22 LTS. `vercel.json` définit l’installation et le build. Ajouter les variables de `.env.example` dans Vercel, dont `APP_URL` avec l’URL HTTPS définitive, puis redéployer après toute modification des variables. Exécuter les migrations depuis un terminal administrateur avant d’ouvrir l’application aux utilisateurs. Ne pas partager la base de production avec des previews non fiables.

Les PDF de 10 Mo sont envoyés directement dans le stockage privé par URL d’envoi signée, puis vérifiés côté serveur avant leur rattachement à une séance. Les téléchargements sont authentifiés et diffusés en streaming. Le nombre de supports ne crée jamais de séance supplémentaire.

## Reprise de l’ancienne installation Sites

L’ancienne installation utilise D1/R2. Ses données et ses PDF ne sont pas transférés par un push GitHub. Conserver cet hébergement le temps d’exporter les données depuis l’espace professeur et de migrer les fichiers vers Supabase en préservant leurs identifiants et empreintes. Les anciens liens et comptes Sites ne deviennent pas automatiquement des comptes Supabase. Aucun transfert de données réelles n’a été exécuté dans cette version du code.

`drizzle/`, le runtime de test Worker et certains outils historiques sont conservés pour les tests de non-régression. Le runtime de production Next.js est `lib/runtime.ts` ; il ne fait pas confiance aux en-têtes d’identité de l’ancien hébergement.

## Vérifications

```sh
npm run typecheck
npm test
npm run test:integration
npm run test:postgres
npm run test:auth
npm run build
```

Les tests utilisent des bases isolées et un fournisseur d’authentification de test ; aucun e-mail réel n’est envoyé. Ils couvrent les semaines ISO, les observations non évaluées, l’historique et les corrections, la publication atomique, les droits parent, les PDF, les invitations, la révocation et les connexions. La livraison réelle des e-mails, OAuth Google et l’accès à Supabase doivent aussi être vérifiés après configuration de ces services.

## Sources et licences

Le programme officiel et sa référence sont conservés dans le projet ; les grilles sont une décomposition pédagogique distincte et versionnée. Marianne est fournie localement avec sa licence dans `public/fonts/`. PDF.js conserve sa licence dans `public/pdf-viewer/`.
