# Repère

Application de suivi de cours de mathématiques : séances, bilans PDF, chapitres, compétences et consultation parent en lecture seule. Interface en français, adaptée au mobile.

## Architecture

Next.js 16 / React 19, PostgreSQL Supabase, Supabase Auth (mot de passe et Google), Supabase Storage privé. Déploiement prévu sur Vercel. Les autorisations sont vérifiées côté serveur sur les données et les PDF. Aucune donnée réelle ni aucun secret n’est inclus dans ce dépôt.

L’accès est réservé à **un seul professeur** et **un seul parent**. La table `account_slots` réserve un emplacement par rôle, protégé par clé primaire et identifiant utilisateur unique. Une inscription Supabase ou une métadonnée `role` n’accorde aucun accès. Les anciens liens sans compte sont désactivés.

Le professeur se connecte avec son adresse e-mail. Le parent utilise un identifiant, par défaut `parent`, et un mot de passe. Il n’a aucune adresse e-mail à fournir : une adresse technique non distribuable est gérée uniquement par le serveur pour Supabase Auth, liée à l’identifiant utilisateur autorisé. Aucun e-mail n’est envoyé au parent. Il peut changer son mot de passe dans « Mon mot de passe ». Le professeur peut réinitialiser ce mot de passe ou révoquer l’accès depuis « Accès parent ».

## Lancement

Node.js 22.13+ (22 LTS recommandé).

```sh
npm ci
cp .env.example .env.local
# Renseigner les variables Supabase, DATABASE_URL et APP_URL.
npm run db:migrate
npm run auth:accounts
npm run dev
```

Ouvrir http://localhost:3000. La commande `auth:accounts` nécessite `TEACHER_EMAIL`, `PARENT_USERNAME` et la configuration Supabase. Elle crée les deux comptes par l’API d’administration avec des mots de passe aléatoires, sans envoyer d’e-mail. Les identifiants initiaux sont enregistrés uniquement dans `work/account-credentials.json`, avec accès local restreint (mode 0600), jamais dans Git ni les logs. Transmettre au parent ses seuls identifiants, puis conserver ces informations dans un endroit privé.

Pour remplacer une ancienne adresse professeur, définir la nouvelle `TEACHER_EMAIL` puis lancer `npm run auth:accounts -- --role teacher --replace-teacher`. Le rôle est retiré à l’ancien compte ; ses données ne sont pas supprimées.

Un compte déjà configuré est conservé. Pour réinitialiser explicitement un mot de passe depuis un terminal administrateur :

```sh
npm run auth:accounts -- --reset-parent
# Ou uniquement le professeur :
npm run auth:accounts -- --role teacher --reset-teacher
```

Le professeur initialise ensuite le suivi de l’élève depuis l’application. Ne pas initialiser un suivi vide avant d’importer un historique existant. Une adresse professeur déjà réservée n’est jamais remplacée silencieusement.

## Configuration externe indispensable

1. Créer un projet Supabase. Copier son URL, sa clé publique et sa clé serveur dans les variables de `.env.example`. `DATABASE_URL` doit être la connexion PostgreSQL du propriétaire, de préférence le transaction pooler port 6543 pour Vercel. Les requêtes préparées persistantes sont désactivées pour ce pooler.
2. Exécuter `npm run db:migrate`. Les migrations créent les tables, activent RLS, retirent l’accès direct aux rôles navigateur et créent le bucket privé `repere-private`. Le serveur utilise la connexion PostgreSQL privilégiée ; ne jamais la mettre dans une variable `NEXT_PUBLIC_`.
3. Désactiver l’inscription publique dans Supabase Auth. L’application bloque aussi `/auth/register`, `/auth/signup` et les invitations publiques côté serveur. Le rôle ne dépend jamais d’un choix dans le formulaire. Régler Site URL sur `APP_URL` et autoriser précisément les callbacks de développement et de production.
4. La récupération du mot de passe professeur par e-mail est facultative et nécessite un SMTP Supabase de production et les modèles `supabase/templates/`. Le compte parent fonctionne sans SMTP. En cas d’oubli, son professeur réinitialise son mot de passe.
5. Pour la connexion Google du professeur uniquement : configurer un client OAuth Google dans Supabase, puis définir `GOOGLE_AUTH_ENABLED=true` dans Vercel. Le bouton reste masqué tant que ce fournisseur n’est pas configuré. Seul le compte professeur déjà autorisé obtient l’accès. Les autres comptes Google sont refusés.

Ces services doivent être réellement configurés : sans eux, la page de connexion affiche un état de configuration manquante et aucun faux compte n’est activé.

## Vercel

Importer `maroua10/Progress_tracking`, répertoire racine du dépôt, preset Next.js, Node.js 22 LTS. `vercel.json` définit l’installation et le build. Ajouter les variables de `.env.example` dans Vercel, dont `APP_URL` avec l’URL HTTPS définitive, puis redéployer après toute modification des variables. Le build Vercel de production applique les migrations versionnées si `DATABASE_URL` est configurée. Les previews ne migrent jamais la base de production. La création initiale des deux comptes se lance séparément depuis le terminal administrateur avec `auth:accounts`. Ne pas partager la base de production avec des previews non fiables.

Les PDF de 10 Mo sont envoyés directement dans le stockage privé par URL d’envoi signée, puis vérifiés côté serveur avant leur rattachement à une séance. Les téléchargements sont authentifiés et diffusés en streaming. Le nombre de supports ne crée jamais de séance supplémentaire.

## Reprise de l’ancienne installation Sites

L’ancienne installation utilise D1/R2. Ses données et ses PDF ne sont pas transférés par un push GitHub. Conserver cet hébergement le temps d’exporter les données depuis l’espace professeur et de migrer les fichiers vers Supabase en préservant leurs identifiants et empreintes. Les anciens liens et comptes Sites ne deviennent pas automatiquement des comptes Supabase. Le transfert de l’historique est une opération distincte du push source ; les données et les documents restent dans les stockages privés.

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

Les tests utilisent des bases isolées et un fournisseur d’authentification de test ; aucun e-mail réel n’est envoyé. Ils couvrent les semaines ISO, les observations non évaluées, l’historique et les corrections, la publication atomique, les droits parent, les PDF, l’interdiction de l’inscription publique, l’unicité des deux rôles, les changements de mot de passe, la révocation et les connexions. La livraison réelle des e-mails, OAuth Google et l’accès à Supabase doivent aussi être vérifiés après configuration de ces services.

## Sources et licences

Le programme officiel et sa référence sont conservés dans le projet ; les grilles sont une décomposition pédagogique distincte et versionnée. Marianne est fournie localement avec sa licence dans `public/fonts/`. PDF.js conserve sa licence dans `public/pdf-viewer/`.
