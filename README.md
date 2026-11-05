# Stockely

**Votre stock, votre commerce, sous contrôle.**

Application web de gestion de stock et de ventes pour commerces indépendants :
catalogue, mouvements de stock, caisse, clients, fournisseurs, rapports et
journal d'audit. Architecture multi-boutiques avec isolation stricte des données.

---

## État du projet

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Audit et planification | ✅ terminée |
| 2 | Fondations : schéma, migrations, auth, Google, reset, isolation, design system | ✅ terminée |
| 3 | Interface complète : navigation, dashboard, composants | ✅ terminée |
| 4 | Produits, stock, ventes, clients, fournisseurs | ✅ terminée |
| 5 | Permissions avancées, audit, notifications | ✅ terminée |
| 6 | Rapports PDF / CSV | ✅ terminée |
| 7 | Tests complets, build, déploiement | ✅ prêt à déployer |
| 8 | Multi-entrepôts, transferts, accès par entrepôt | ✅ implémentée, migrations appliquées en production |

> La connexion Google et l'envoi d'e-mails de réinitialisation sont **implémentés
> mais inactifs tant que leurs variables d'environnement ne sont pas renseignées**.
> L'application l'indique explicitement, sans simuler un succès.

---

## Fonctionnalités

### Pilotage

- Tableau de bord alimenté par les données réelles de la boutique active.
- Chiffre d'affaires du jour et du mois, ventes, panier moyen, marge.
- Alertes de stock faible et de rupture, avec liens directs vers les produits.
- Accès rapides à la caisse, aux ventes récentes, au stock et aux rapports.

### Catalogue

- Produits avec SKU unique par boutique, code-barres, catégorie et fournisseur.
- Prix de vente et prix d'achat en unité mineure entière, sans flottant.
- Seuil d'alerte par produit, stock initial matérialisé par un mouvement.
- Archivage et restauration : l'historique et les ventes passées restent intacts.
- Recherche par nom, SKU ou code-barres ; catégories gérables dans l'interface.

### Stock

- **Multi-entrepôts** : stock détenu par entrepôt, stock total par produit et
  sélecteur d'entrepôt de travail dans la navigation.
- `warehouse_stock` est la **source de vérité**. `products.quantity` reste un
  cache dénormalisé du total, maintenu par toutes les écritures.
- Mouvements d'entrée, de sortie et de correction d'inventaire, rattachés à
  l'entrepôt actif.
- Mise à jour atomique avec verrou de ligne PostgreSQL : pas de stock négatif
  ni d'écrasement concurrent. Une clé d'idempotence optionnelle évite de rejouer
  un mouvement réseau dupliqué.
- Historique complet par produit, boutique et entrepôt, avec auteur et motif.
- Les rapports et l'export CSV du stock restent **consolidés tous entrepôts** ;
  ils l'indiquent explicitement à l'écran.
- Chaque mouvement est journalisé dans l'audit.

### Caisse et ventes

- Panier, recherche produit, scan de code-barres, quantités et remise.
- **Prix et stock recalculés côté serveur** : le navigateur ne fixe jamais le prix.
- Une vente est rattachée à l'entrepôt actif : la disponibilité est vérifiée
  dans cet entrepôt, pas seulement sur le total de la boutique.
- Création atomique de la vente, des lignes, du paiement, du mouvement de stock
  et du compteur de facture.
- Idempotence par clé unique : un double clic ne crée pas deux ventes.
- Moyens de paiement : espèces, mobile money, carte, autre.
- Reçu imprimable, historique filtrable, détail de vente avec marge et paiement.
- Annulation complète : stock réintégré, paiement remboursé, mouvements
  compensatoires et audit, sans suppression de données.

### Clients et fournisseurs

- Fiches contact, coordonnées, notes internes, recherche.
- Historique d'achats et total dépensé par client.
- Rattachement des produits aux fournisseurs.
- Suppression protégée lorsque des ventes ou produits y sont rattachés.

### Rapports

- Période libre avec raccourcis 7 jours, 30 jours et mois en cours.
- Chiffre d'affaires, panier moyen, marge brute, remises accordées.
- Évolution quotidienne du chiffre d'affaires.
- Produits les plus vendus, avec marge lorsque les coûts sont complets.
- Répartition des encaissements par moyen de paiement.
- Valorisation du stock et alertes de rupture / stock faible.
- **Exports CSV** ventes et stock : UTF-8 avec BOM, séparateur `;`, décimales
  françaises, adaptés à Excel.
- **PDF via l'impression du navigateur** : bouton « Imprimer / PDF » et mise en
  page dédiée, sans dépendance PDF côté serveur.
- Chaque export est tracé dans le journal d'audit.

### Assistant IA

- **Assistant flottant** disponible sur toutes les pages de l'application :
  questions en langage naturel sur le stock, les ventes, la marge et les
  réapprovisionnements.
- **Synthèse IA des rapports** : bouton « Résumé IA » sur la page Rapports,
  limité à la période affichée.
- **Aide à la saisie produit** : proposition de description depuis le nom et la
  catégorie, modifiable avant enregistrement.
- Contexte reconstruit côté serveur à partir de la **boutique active** : le
  navigateur ne peut ni choisir la boutique, ni injecter d'instructions
  système. Aucune donnée nominative client n'est envoyée au modèle.
- Clé API **exclusivement serveur**, limitation de débit persistée (5 requêtes
  par minute et 30 par heure et par utilisateur), gestion des erreurs du
  fournisseur (`429`, `503`) sans fuite de détail interne.
- Sans `ITERACOMPUTE_API_KEY`, les routes `/api/ai/*` répondent
  `503 ai_not_configured` : aucun résultat n'est simulé.

### Journal d'audit

- Historique en ajout seul des connexions, ventes, annulations, mouvements,
  modifications du catalogue, contacts et exports.
- Filtres par recherche, utilisateur, action, entité et période.
- Métadonnées détaillées et liens vers la vente, le produit, le client ou le
  fournisseur concerné.
- Table protégée en base par des triggers PostgreSQL contre `UPDATE`, `DELETE`
  et `TRUNCATE`.

### Multi-boutiques, entrepôts et rôles

- Isolation serveur : la boutique active provient toujours de l'adhésion liée à
  la session, jamais d'un identifiant fourni par le client.
- Changement de boutique pour les utilisateurs qui ont plusieurs adhésions.
- Rôles : propriétaire, administrateur, gestionnaire de stock, caissier,
  consultation.
- **Accès par entrepôt** : propriétaire, administrateur et gestionnaire de stock
  voient tous les entrepôts ; les autres rôles ne voient que leurs attributions
  explicites, sinon l'entrepôt par défaut.
- L'entrepôt de travail est mémorisé dans le cookie httpOnly
  `stockely_warehouse`. Sa valeur est **toujours revérifiée** côté serveur :
  un identifiant d'une autre boutique renvoie `404 warehouse_not_found`.
- Création, renommage, changement de code, changement d'entrepôt par défaut,
  archivage protégé (refusé si du stock subsiste ou s'il s'agit du dernier
  entrepôt actif) et attribution des membres.
- Navigation et actions filtrées par permissions, contrôle serveur sur chaque
  route et chaque service.

---

## Stack

- **Next.js 16** (App Router, React 19, TypeScript strict)
- **Tailwind CSS 4** — design system blanc / vert
- **PostgreSQL** (Neon recommandé) + **Drizzle ORM** + migrations SQL versionnées
- **Argon2id** (`@node-rs/argon2`) pour les mots de passe
- **Zod** pour la validation des entrées
- **Vitest** pour les tests unitaires et d'intégration
- **IteraCompute** (API compatible OpenAI) pour l'assistant IA

### Identité visuelle

Le logo source (`logo/logo.png`) est décliné en assets PNG dans `public/brand/` :

- `stockely-mark.png` — pastille verte seule, pour les en-têtes compacts ;
- `stockely-logo.png` — lockup horizontal pour les fonds clairs ;
- `stockely-logo-white.png` — lockup horizontal pour les fonds sombres.

Les favicons (`src/app/icon.png`, `src/app/apple-icon.png`) sont dérivés de la
pastille. Les composants `Logo`, `LogoMark` et `LogoLockup`
(`src/components/brand/logo.tsx`) centralisent leur usage.

## Arborescence

```
src/
  app/
    (marketing)/          page publique
    (auth)/               connexion, inscription, mot de passe oublié/reset
    (app)/                espace privé : dashboard, produits, stock, ventes,
                          clients, fournisseurs, rapports, audit
    api/                  routes API (auth, catalogue, stock, ventes, exports, IA)
  components/             UI réutilisable, navigation, caisse, formulaires
  lib/                    env, monnaie, dates, libellés, client API
  server/
    ai/                   client IteraCompute, contexte boutique, prompts
    auth/                 sessions, CSRF, rate-limit, Argon2id, OAuth Google
    db/                   schéma Drizzle, pool PostgreSQL, erreurs
    services/             logique métier : produits, stock, ventes, rapports…
    validation/           schémas Zod
    permissions.ts        matrice de rôles
    audit.ts              journal d'audit
drizzle/                  migrations SQL générées + garde-fou audit
scripts/                  création du propriétaire, seed de démonstration
tests/                    tests Vitest unitaires et d'intégration
```

---

## Installation

### 1. Prérequis

- Node.js 20 ou supérieur
- Un projet PostgreSQL (Neon recommandé)
- Git (optionnel)

> **Windows / PowerShell** : si `npm` est bloqué par la stratégie d'exécution,
> utilisez `npm.cmd` à la place de `npm`, ou autorisez les scripts locaux :
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### 2. Dépendances

```bash
npm install
```

### 3. Base de données Neon

1. Créer un projet sur [neon.tech](https://neon.tech) (région proche de vos utilisateurs).
2. Copier la **chaîne de connexion « Pooled »**, avec `sslmode=require`.
3. Créer le fichier `.env` à partir de `.env.example` et renseigner :

```env
DATABASE_URL="postgresql://user:motdepasse@ep-xxx-pooler.eu-central-1.aws.neon.tech/stockely?sslmode=require"
APP_SECRET="une-chaine-aleatoire-de-64-caracteres"
APP_URL="https://stockely.vercel.app"
NODE_ENV="development"
DEFAULT_CURRENCY="XOF"
DEFAULT_TIMEZONE="Africa/Lome"
# true uniquement derrière un proxy de confiance qui écrase X-Forwarded-For
TRUST_PROXY="false"

# Facultatif — voir sections Google et e-mail
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
RESEND_API_KEY=""
EMAIL_FROM=""
# Facultatif — assistant IA (voir section dédiée)
ITERACOMPUTE_API_KEY=""
ITERACOMPUTE_MODEL="qwen/qwen3.8-27b"
```

Générer un `APP_SECRET` solide :

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

### 4. Migrations

```bash
npm run db:migrate
```

Les migrations créent le schéma, les contraintes, les index et le garde-fou
qui empêche toute modification ou suppression du journal d'audit.

La migration `0003_multi_warehouse` est **additive** : elle crée `warehouses`,
`warehouse_stock` et `warehouse_access`, ajoute `warehouse_id` à `sales` et
`stock_movements`, puis :

1. crée un entrepôt `MAIN` par boutique existante ;
2. recopie `products.quantity` dans `warehouse_stock` ;
3. rattache l'historique des ventes et mouvements à `MAIN` ;
4. vérifie que le total par entrepôt égale exactement `products.quantity` et que
   chaque boutique possède un entrepôt. En cas d'écart, la migration échoue et
   la transaction est annulée.

> `warehouse_stock` devient la source de vérité. `products.quantity` reste un
> cache du total, maintenu atomiquement par les services.

**Avant d'appliquer une migration à la base principale** : créer une branche
Neon ou une sauvegarde vérifiée, appliquer la migration sur une branche de test,
puis seulement ensuite sur la production. Ne jamais lancer `db:migrate` contre une
base inconnue sans sauvegarde préalable.

La base de production `stockely` est à jour (5/5 migrations appliquées le
2026-10-27). Pour toute nouvelle migration, suivre le runbook
**[docs/PRODUCTION_MIGRATION.md](docs/PRODUCTION_MIGRATION.md)** : il détaille la
sauvegarde, les garde-fous, la restauration et le journal de migration.

```bash
# 1. État en lecture seule (aucune écriture)
npm run db:status

# 2. Migration guardée : confirmation + référence de sauvegarde obligatoires
BACKUP_REFERENCE="neon:br-xxxx (2026-10-28)" npm run db:migrate:prod -- --confirm=APPLY
```

`db:migrate:prod` refuse une base dont le nom ressemble à une base de test, un
schéma partiellement appliqué et une exécution concurrente. Il revérifie les
invariants après migration. Si aucune migration n'est en attente, il ne fait
qu'un contrôle et sort avec le code `0`.

Après la migration, vérifier l'invariant en lecture seule :

```bash
npm run db:check:warehouses
```

La commande échoue si une boutique n'a pas d'entrepôt, si un produit a un cache
différent de la somme de ses entrepôts ou si une quantité est négative.

#### Schéma complet sans CLI (base neuve ou déjà initialisée)

Si vous ne pouvez pas lancer la CLI (par exemple pour initialiser un projet
Neon depuis l'éditeur SQL du tableau de bord), utilisez le script consolidé :

```text
scripts/neon-init.sql
```

Il contient l'intégralité des migrations `0000` à `0004` : types énumérés,
28 tables, index, contraintes et garde-fous du journal d'audit.

Le script est **idempotent** : chaque type, table, colonne, contrainte, index
et déclencheur n'est créé que s'il manque. Il peut donc être relancé sans
erreur `already exists`, sur une base vide comme sur une base déjà en service,
et il ne supprime ni ne modifie aucune donnée existante.

Mode d'emploi :

1. Neon → **SQL Editor**.
2. Coller tout le contenu de `scripts/neon-init.sql`.
3. **Run**.
4. Renseigner `DATABASE_URL` (chaîne « Pooled ») dans `.env` et sur Vercel.
5. Vérifier : `npm run db:status` puis `npm run db:check:warehouses`.

Comportement sur une base déjà peuplée :

- les objets existants sont ignorés ;
- l'entrepôt `MAIN` et les lignes de `warehouse_stock` manquants sont créés,
  les autres sont laissés tels quels (`ON CONFLICT DO NOTHING`) ;
- les écarts d'inventaire sont signalés en `WARNING` dans la sortie, sans
  interrompre l'exécution.

> Après une exécution manuelle, la table de suivi Drizzle n'est pas remplie :
> considérez les migrations comme appliquées et ne relancez pas
> `db:migrate:prod` sur cette base.

### 5. Premier compte propriétaire

Deux possibilités :

- **Via l'interface** : ouvrir `/register`, créer la boutique. Le premier compte
  est automatiquement propriétaire de sa boutique.
- **Via le script** (utile en production) :

```bash
OWNER_PASSWORD='mot-de-passe-solide' npm run db:create-owner -- \
  --email owner@exemple.com --name "Awa Diallo" --shop "Maison Lumen"
```

Le script est idempotent : relancé, il promeut le compte existant en propriétaire
sans écraser son mot de passe.

### 6. Démarrage

```bash
npm run dev
```

- Local : http://localhost:3000
- Production : https://stockely.vercel.app
- Santé : https://stockely.vercel.app/api/health

### 7. Données de démonstration (développement uniquement)

```bash
SEED_OWNER_PASSWORD='...' SEED_CASHIER_PASSWORD='...' npm run db:seed
```

Le seed crée la boutique **Maison Lumen (démo)**, en XOF / Africa/Lome, avec un
catalogue, des clients, des fournisseurs et deux comptes :

| Rôle | E-mail |
| --- | --- |
| Propriétaire | `owner@maison-lumen.example` |
| Caissier | `caissier@maison-lumen.example` |

Les mots de passe sont ceux fournis dans les variables `SEED_OWNER_PASSWORD` et
`SEED_CASHIER_PASSWORD` au moment du seed (voir le `.env` local, jamais versionné).

Le seed refuse de s'exécuter si `NODE_ENV=production` et ne modifie jamais une
boutique existante.

### 8. Parcours de démonstration

1. **Connexion** avec le compte propriétaire, puis vérifier le tableau de bord.
2. **Vendre** : ajouter deux produits, choisir un client et « Mobile money »,
   encaisser. Le reçu affiche le numéro de facture (`ML-…`).
3. **Ventes** : ouvrir la vente, consulter la marge et le paiement.
4. **Entrepôts** : créer un second entrepôt, basculer le sélecteur, vérifier que
   le stock du catalogue et de la caisse suit l'entrepôt actif.
5. **Stock** : créer une entrée ou une correction dans l'entrepôt actif, vérifier
   la ventilation sur la fiche produit et l'historique.
6. **Rapports** : ajuster la période, vérifier les totaux, les encaissements et
   la valorisation ; télécharger les CSV ou utiliser « Imprimer / PDF ».
7. **Audit** : retrouver la vente, le mouvement et les exports, avec leurs
   métadonnées.
8. Se reconnecter avec le compte caissier pour vérifier les permissions : pas de
   remise, pas d'annulation, pas d'écriture produit ni stock, pas de rapports, et
   uniquement les entrepôts autorisés.

---

## Connexion Google (facultatif)

1. Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   créer un identifiant **OAuth client ID** de type *Application Web*.
2. Ajouter les URI de redirection autorisés :
   `https://stockely.vercel.app/api/auth/google/callback` (production) et,
   si nécessaire, `http://localhost:3000/api/auth/google/callback` (développement
   uniquement).
3. Renseigner dans `.env` :

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="https://stockely.vercel.app/api/auth/google/callback"
```

4. Sur Vercel, définir `APP_URL=https://stockely.vercel.app` et
   `GOOGLE_REDIRECT_URI=https://stockely.vercel.app/api/auth/google/callback`
   dans *Settings → Environment Variables*, puis redéployer.

Fonctionnement :

- Un compte dont l'e-mail Google est **vérifié** est relié à l'identité Google.
- Un nouvel utilisateur Google obtient une boutique dont il est propriétaire
  (nommée « Boutique de … », renommable ensuite), avec un entrepôt principal
  par défaut. Les boutiques créées par d'anciens comptes Google sans entrepôt
  sont réparées automatiquement à la connexion suivante.
- Le flux utilise **PKCE S256**, un **state** à usage unique en cookie
  `HttpOnly` et ne fait jamais confiance à un e-mail non vérifié.
- Sans identifiants configurés, `/api/auth/google/start` renvoie vers la
  connexion avec le message `google_not_configured`.

## Vérification de l'adresse e-mail (Resend)

À l'inscription par e-mail, un lien de confirmation est envoyé via Resend.
Le compte reste utilisable immédiatement ; un bandeau dans l'application
permet de renvoyer l'e-mail tant que l'adresse n'est pas confirmée.

- Le jeton est signé (HMAC-SHA256 avec `APP_SECRET`), valable 24 heures.
- Il transite dans le **fragment** d'URL (`/verify-email#token=…`), donc
  jamais dans les journaux, proxys ou en-têtes `Referer`.
- Le renvoi est limité à 3 e-mails par heure et par compte.
- Sans `RESEND_API_KEY` ou `EMAIL_FROM`, aucun e-mail n'est simulé et le
  renvoi répond `503 email_not_configured`.

## Réinitialisation du mot de passe (Resend)

Le parcours « Mot de passe oublié » nécessite un fournisseur d'e-mail :

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="Stockely <no-reply@votre-domaine.com>"
```

- Le domaine de `EMAIL_FROM` doit être vérifié dans Resend.
- Le jeton est aléatoire (256 bits), stocké **haché** (SHA-256), valable 60
  minutes et **à usage unique**.
- La réponse de la demande est identique que le compte existe ou non
  (anti-énumération), avec un rate-limit par compte et par IP.
- Après réinitialisation, toutes les sessions du compte sont révoquées.
- Un compte créé uniquement via Google peut définir un mot de passe par ce flux.
- Sans `RESEND_API_KEY` ou `EMAIL_FROM`, l'API répond clairement
  `503 email_not_configured` : aucun e-mail n'est simulé et aucun jeton n'est
  journalisé.

## Assistant IA (IteraCompute)

L'assistant utilise l'API d'[IteraCompute](https://iteracompute.com), compatible
avec le format OpenAI. Le modèle gratuit `qwen/qwen3.8-27b` est utilisé par
défaut (30 millions de jetons par mois, offre promotionnelle jusqu'au
24 novembre 2026).

```env
ITERACOMPUTE_API_KEY="sk-..."
ITERACOMPUTE_BASE_URL="https://api.iteracompute.com/v1"
ITERACOMPUTE_MODEL="qwen/qwen3.8-27b"
```

- La clé est lue **uniquement côté serveur** par `src/server/ai/client.ts`.
  Elle n'est jamais préfixée `NEXT_PUBLIC_`, jamais renvoyée au navigateur et
  jamais écrite dans un journal.
- Créer la clé sur la page **API Keys** d'IteraCompute, puis la déclarer dans
  `.env` en local et dans les variables d'environnement Vercel. La révoquer
  immédiatement si elle a été partagée.
- Routes protégées par session, contrôle d'origine, jeton CSRF, validation Zod
  et permission :
  - `POST /api/ai/chat` — assistant conversationnel (tout membre authentifié) ;
  - `POST /api/ai/summary` — synthèse d'une période (`reports.read`) ;
  - `POST /api/ai/product-description` — aide à la saisie (`products.write`).
- Le contexte est reconstruit à chaque appel depuis la boutique active. Les
  données nominatives (clients, e-mails, téléphones) ne sont pas transmises.
- Limites : 5 requêtes par minute et 30 par heure et par utilisateur. Les
  erreurs `429` et `503` du fournisseur sont traduites en messages sobres.
- Coût : le modèle gratuit renvoie `cost: 0`. Un modèle payant peut être choisi
  via `ITERACOMPUTE_MODEL`, avec les tarifs du fournisseur.

> L'assistant ne remplace pas un contrôle humain : les montants et
> recommandations générés doivent être vérifiés avant toute décision.

---

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | Oxlint |
| `npm test` | Tests Vitest |
| `npm run db:generate` | Génère une migration depuis le schéma |
| `npm run db:migrate` | Applique les migrations (développement) |
| `npm run db:migrate:test` | Applique les migrations à la base de test |
| `npm run db:status` | État en lecture seule d'une base (migrations, volumes, invariants) |
| `npm run db:migrate:prod` | Migration de production guardée (`--confirm=APPLY` + `BACKUP_REFERENCE`) |
| `npm run db:check:warehouses` | Vérifie en lecture seule l'invariant multi-entrepôts |
| `npm run db:create-owner` | Crée ou promeut un propriétaire |
| `npm run db:seed` | Données de démonstration (hors production) |

---

## Sécurité

- **Mots de passe** : Argon2id (19 MiB, 2 itérations), jamais stockés ni journalisés en clair.
- **Connexion Google** : OAuth 2.0 + PKCE S256, `state` aléatoire en cookie
  `HttpOnly`, e-mail Google vérifié obligatoire, liaison par identifiant
  fournisseur (`auth_identities`). Le callback valide et borne `state`, `code`
  et `error`, consomme le `state` une seule fois, supprime les cookies OAuth
  sur tous les chemins et répond avec `Referrer-Policy: no-referrer`.
- **Réinitialisation** : jeton 256 bits haché en base, 60 minutes, usage unique,
  rate-limit par compte et par IP, révocation de toutes les sessions après
  changement.
- **Sessions** : jetons opaques de 256 bits, stockés **hachés** (SHA-256) en base.
  Cookie `HttpOnly`, `Secure` en HTTPS, `SameSite=Lax`, expiration à 14 jours,
  révocation à la déconnexion.
- **CSRF** : jeton lié à la session, requis sur les mutations, complété par la
  vérification de l'en-tête `Origin` et par l'obligation d'un corps JSON.
- **Limitation des connexions** : 5 échecs par e-mail et 20 par IP sur 15 minutes,
  persistés en base (résiste aux redémarrages et aux instances multiples).
  Les en-têtes d'IP ne sont pris en compte que sur Vercel/Cloudflare ou si
  `TRUST_PROXY=true` est explicitement configuré derrière un proxy de confiance.
- **Validation des entrées** : schémas Zod sur les corps, identifiants UUID
  vérifiés avant l'ORM, recherches et pagination bornées, corps JSON limité à
  256 Ko avec lecture en flux.
- **Isolation multi-boutiques** : la boutique active est toujours résolue depuis
  l'adhésion liée à la session. Un `shopId` envoyé par le client n'est jamais
  utilisé sans vérification d'adhésion.
- **Isolation des entrepôts** : le cookie `stockely_warehouse` est httpOnly mais
  n'est jamais fiable par lui-même. Chaque résolution vérifie que l'entrepôt
  appartient à la boutique active et que le membre y a accès. Un identifiant
  d'une autre boutique renvoie `404`, jamais une fuite d'existence.
- **Permissions** : contrôle serveur sur chaque route protégée, matrice de rôles
  et surcharges individuelles.
- **Audit** : table en ajout seul, protégée par trigger PostgreSQL contre
  `UPDATE`, `DELETE` et `TRUNCATE`.
- **Exports CSV** : authentifiés, soumis à `reports.export`, sans injection de
  formules (valeurs échappées, séparateur maîtrisé) et journalisés.
- **En-têtes** : CSP (sans `unsafe-eval` en production), HSTS en production,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` et
  `Cross-Origin-Resource-Policy`.
- **Journaux** : aucun mot de passe, jeton, code OAuth, cookie ou chaîne de
  connexion ; les erreurs serveur ne sont journalisées qu'avec leur type et leur
  code technique en production.
- **Erreurs** : messages génériques en production, aucun détail interne exposé.

### Modèle de rôles

| Rôle | Portée |
| --- | --- |
| Propriétaire | Tous les droits |
| Administrateur | Tous les droits opérationnels |
| Gestionnaire de stock | Produits, catégories, fournisseurs, stock, rapports, audit |
| Caissier | Ventes, clients, lecture du catalogue et du stock |
| Consultation | Lecture seule |

Les surcharges de permissions sont stockées dans `memberships.permission_overrides`
et calculées côté serveur.

---

## Données et calculs

- Tous les montants sont stockés en **unité mineure entière** (`bigint`), jamais en
  flottant. L'affichage divise une seule fois au dernier moment.
- Chaque boutique possède sa **devise** et son **fuseau horaire**.
- Une vente fige le prix, le coût et le nom du produit au moment de la transaction.
- `products.quantity` est un cache du total. L'invariant
  `products.quantity = Σ warehouse_stock.quantity` est maintenu dans la même
  transaction que chaque mouvement, vente ou annulation.
- Une vente est rattachée à un seul entrepôt en v1 ; le multi-entrepôt par ligne
  viendra avec les transferts.
- Le chiffre d'affaires, le coût des marchandises et la marge sont distincts.
  Le bénéfice n'est affiché que si les coûts sont disponibles.
- La valeur du stock utilise le prix d'achat lorsqu'il est connu, sinon le prix de
  vente (hypothèse documentée).
- Une annulation crée un mouvement compensatoire ; rien n'est supprimé.
- En XOF, les valeurs sont conservées au centième et affichées en unités entières.

### Rapports et exports

- La période par défaut couvre les 30 derniers jours ; les dates sont validées
  côté serveur et les bornes inversées sont remises dans l'ordre.
- Les ventes annulées sont exclues des agrégats de chiffre d'affaires, mais
  restent présentes dans l'export détaillé des ventes avec leur statut.
- Les CSV utilisent `;`, une virgule décimale et un BOM UTF-8 pour Excel français.
- Le PDF est produit par l'impression du navigateur : aucune bibliothèque PDF
  n'est nécessaire et le rendu suit les styles d'impression de l'application.

---

## Sauvegarde et restauration

> Procédure complète, avec garde-fous et restauration Neon :
> **[docs/PRODUCTION_MIGRATION.md](docs/PRODUCTION_MIGRATION.md)**.

### Sauvegarde locale

```bash
pg_dump "$DATABASE_URL" --format=custom --file="stockely-$(date +%Y%m%d-%H%M).dump"
```

Conserver les fichiers hors du dépôt et chiffrés.

### Restauration

```bash
# Sur une base vide dédiée :
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" stockely-20260101-1200.dump
```

`pg_restore --clean` **supprime les objets existants** : à n'utiliser qu'après
sauvegarde et sur une base identifiée.

### Neon

- Activer la **restauration à un instant donné (PITR)** dans la console Neon.
- Créer une **branche** avant toute opération risquée (migration, test manuel).
- Pour les tests d'intégration, utiliser une branche dédiée via `TEST_DATABASE_URL`.

### Surveillance

- `/api/health` renvoie `200` avec
  `{"status":"ok","db":"ok","config":"ok","features":{"google":false,"email":false,"ai":false}}`.
  Les indicateurs `google`, `email` et `ai` signalent seulement si les
  intégrations sont configurées, jamais de secret.
- Configurer une alerte sur les réponses `503` et sur la latence de la base.
- Surveiller les tentatives de connexion échouées (`login_attempts`).

---

## Déploiement (Vercel + Neon)

1. Importer le dépôt dans Vercel (framework **Next.js** détecté).
2. Variables d'environnement (Production et Preview) :
   `DATABASE_URL`, `APP_SECRET`, `APP_URL`, `NODE_ENV=production`.
   Ajouter si utilisés : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `ITERACOMPUTE_API_KEY`, `ITERACOMPUTE_MODEL` (et éventuellement
   `ITERACOMPUTE_BASE_URL`).
3. **Créer une branche Neon de sauvegarde**, puis appliquer les migrations
   **depuis votre machine** avec le runbook
   [`docs/PRODUCTION_MIGRATION.md`](docs/PRODUCTION_MIGRATION.md) :

   ```bash
   npm run db:status
   BACKUP_REFERENCE="neon:br-xxxx (date)" npm run db:migrate:prod -- --confirm=APPLY
   npm run db:status
   npm run db:check:warehouses
   ```

   Un échec annule la transaction ; si les invariants restent en échec après
   migration, restaurer la branche de sauvegarde (voir le runbook).
4. Déployer.
5. Vérifier `https://<domaine>/api/health`.
6. Créer le propriétaire via `db:create-owner` ou l'inscription.
7. Activer les sauvegardes Neon et la surveillance.

Ne jamais exposer `DATABASE_URL` ou `APP_SECRET` au navigateur : aucune variable
n'est préfixée `NEXT_PUBLIC_`.

---

## Tests

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

### Couverture actuelle

- Matrice de permissions et séparation des rôles.
- Hachage Argon2id et vérification des mots de passe.
- Slugs, formatage monétaire et schémas de validation Zod.
- Hachage des jetons de session et de réinitialisation.
- Réinitialisation du mot de passe en intégration : jeton à usage unique,
  expiration, rate-limit, révocation des sessions.
- **Isolation multi-boutiques** : un utilisateur d'une boutique ne lit ni ne
  modifie les données d'une autre.
- **Isolation des entrepôts** : un entrepôt d'une autre boutique est refusé (404),
  et un caissier ne voit que ses entrepôts attribués.
- **Concurrence de stock** : mouvements simultanés sérialisés par verrou de ligne.
- **Ventilation par entrepôt** : une vente décrémente uniquement l'entrepôt
  choisi ; le total et les autres entrepôts restent cohérents.
- **Stock insuffisant par entrepôt** : une vente est refusée même si le total de
  la boutique est suffisant.
- **Idempotence des ventes** : deux requêtes avec la même clé créent une seule vente.
- **Idempotence des mouvements de stock** : une clé rejouée ne décrémente qu'une fois.
- **Compensation d'annulation** : stock réintégré dans l'entrepôt d'origine,
  paiement remboursé, audit.
- **Permission de remise** : un caissier ne peut pas appliquer une remise.

### Tests d'intégration

Ils utilisent une base **séparée** et sont ignorés si `TEST_DATABASE_URL` est
vide. Ne jamais pointer cette variable vers la base de développement ou de
production.

```bash
# 1. Créer la base (nom contenant "test") puis renseigner TEST_DATABASE_URL
node scripts/create-database.mjs stockely_test

# 2. Appliquer le schéma à la base de test
npm run db:migrate:test

# 3. Lancer les tests
npm test
```

Le script `db:migrate:test` refuse toute URL dont le nom de base ne contient pas
`test`. Les tests d'intégration créent des comptes et boutiques de test uniques ;
la base de test reste jetable.

---

## Limites connues

- Paiement mobile money / carte : mode enregistré uniquement, aucune confirmation
  d'un prestataire externe.
- Connexion Google : nécessite des identifiants OAuth et une URI de redirection
  autorisée. Non testée sans configuration réelle.
- E-mails de réinitialisation : nécessitent Resend et un domaine vérifié. Sans
  configuration, l'API répond `503` au lieu de simuler un envoi.
- PDF : produit par l'impression du navigateur, pas par un moteur PDF serveur.
- Annulation : uniquement la vente complète ; pas de remboursement partiel ni
  d'échange ligne par ligne.
- Transferts entre entrepôts et inventaires tournants : **pas encore livrés**
  (P2). Le stock est déjà ventilé et les entrepôts sont gérables, mais il n'existe
  pas encore de document de transfert avec machine à états.
- Une vente reste rattachée à un seul entrepôt ; pas de panier multi-entrepôt.
- Pas de lots, de péremption ni de FIFO : coût moyen pondéré au niveau boutique.
- Les rôles gestionnaire d'entrepôt, magasinier et comptable ne sont pas encore
  ajoutés ; la restriction par entrepôt fonctionne avec les rôles actuels.
- Pas de moteur de TVA : les prix sont saisis TTC selon la configuration de la
  boutique.
- Le rate-limit persistant couvre la connexion, la réinitialisation du mot de
  passe et l'assistant IA ; les autres routes s'appuient sur l'authentification,
  le CSRF et les permissions.
- Assistant IA : dépend d'un service externe. Sans clé, les routes répondent
  `503` ; en cas de forte demande du modèle gratuit, une attente ou un `429`
  peut survenir. Le support client public n'est pas branché sur l'IA afin
  d'éviter une consommation abusive non authentifiée.
- Pas de mode hors ligne : la caisse nécessite une connexion au serveur.
