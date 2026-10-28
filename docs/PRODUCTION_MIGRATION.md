# Migration de production

Ce document décrit la procédure **obligatoire** pour appliquer une migration à la
base de production Stockely (Neon). Il complète la section « Migrations » du
`README.md`.

> Règle de base : aucune migration ne part en production sans sauvegarde
> vérifiée, sans état des lieux en lecture seule et sans confirmation explicite.

---

## 1. Ce que font les scripts

| Script | Commande | Écritures | Rôle |
| --- | --- | --- | --- |
| `scripts/db-status.mjs` | `npm run db:status` | **aucune** | Rapporte migrations appliquées/en attente, tables présentes, volumes, invariants. |
| `scripts/db-migrate-production.mjs` | `npm run db:migrate:prod` | migrations uniquement | Applique les migrations Drizzle avec garde-fous et vérification finale. |
| `scripts/check-warehouse-stock.mjs` | `npm run db:check:warehouses` | **aucune** | Vérifie l'invariant multi-entrepôts (cache `products.quantity` = somme des entrepôts, pas de stock négatif). |

`db:status` accepte une cible explicite :

```bash
npm run db:status -- --url="postgres://…"
```

`db:migrate:prod` lit **uniquement** `DATABASE_URL` (chargée depuis `.env` ou
l'environnement d'exécution). C'est volontaire : la cible doit être sans ambiguïté.

---

## 2. Garde-fous de `db:migrate:prod`

Le script refuse de s'exécuter si l'un de ces contrôles échoue :

1. `DATABASE_URL` absent.
2. `--confirm=APPLY` absent.
3. `BACKUP_REFERENCE` absent ou plus court que 4 caractères.
4. Le nom de la base ressemble à une base de test (`test`, `_test`, `test_`).
5. Le schéma est **partiellement** appliqué (une partie seulement des tables
   multi-entrepôts ou transferts existe).
6. PostgreSQL est antérieur à la version 12 (nécessaire pour l'ajout de valeurs
   d'énumération dans une transaction, utilisé par `0004`).
7. Une autre exécution détient déjà le verrou consultatif PostgreSQL.

Après migration, le script échoue encore si :

- une migration reste en attente ;
- le schéma est partiel ;
- un invariant est cassé (boutique sans entrepôt par défaut, cache produit
  incohérent, stock négatif, vente ou mouvement sans entrepôt).

Un échec **après** migration ne restaure rien automatiquement : il faut restaurer
la sauvegarde (section 6). Le script affiche explicitement cette consigne.

### Chemin « aucune migration en attente »

Si `db:status` indique `0` migration en attente, `db:migrate:prod` affiche
`Aucune migration en attente.`, revérifie les invariants et sort avec le code `0`
sans écrire en base. Ce chemin est sans risque et sert de vérification.

---

## 3. Prérequis

- Accès à la console Neon (ou `neonctl`) pour créer une branche de sauvegarde.
- `DATABASE_URL` de production dans `.env` **ou** injectée dans le shell.
- Un terminal à la racine du dépôt, dépendances installées (`npm install`).
- L'application **pas** en cours de déploiement pendant la migration.
- Idéalement : aucun utilisateur actif (les migrations prennent quelques
  secondes et posent des verrous).

Sous PowerShell, pour cibler explicitement une base dans la session courante :

```powershell
$env:DATABASE_URL = "postgres://…/stockely"
$env:BACKUP_REFERENCE = "neon:br-xxxx (2026-10-28)"
```

Sous bash :

```bash
export DATABASE_URL="postgres://…/stockely"
export BACKUP_REFERENCE="neon:br-xxxx (2026-10-28)"
```

---

## 4. Procédure pas à pas

### Étape 0 — Photographie de l'état initial

```bash
npm run db:status
```

Noter et conserver la sortie :

- base et utilisateur ;
- nombre de migrations appliquées / en attente ;
- volumes (boutiques, produits, ventes, entrepôts, lignes de stock) ;
- état des invariants.

Cette sortie est la référence pour comparer après migration. Un `db:status` qui
sort en code `1` signifie : schéma partiel ou invariant cassé → **ne pas migrer**.

### Étape 1 — Sauvegarde

Deux options, la branche Neon étant la plus rapide à restaurer.

**Option A — branche Neon (recommandée)**

1. Console Neon → projet → **Branches** → **New branch**.
2. Source : la branche de production, au moment présent.
3. Nommer la branche explicitement, par exemple `backup-2026-10-28-avant-0004`.
4. Vérifier qu'elle apparaît en état **Ready**.
5. Renseigner `BACKUP_REFERENCE` avec l'identifiant de branche et la date :
   `BACKUP_REFERENCE="neon:br-xxxx (2026-10-28)"`.

**Option B — dump logique**

```bash
pg_dump "$DATABASE_URL" --format=custom --file="stockely-20261028-avant-migration.dump"
```

Puis vérifier que le fichier est non vide et lisible :

```bash
pg_restore --list "stockely-20261028-avant-migration.dump" | head
```

Conserver le dump hors du dépôt, chiffré. `pg_dump` n'est pas installé par défaut
sur toutes les machines : dans ce cas, utiliser la branche Neon.

### Étape 2 — Vérifier la sauvegarde

Une sauvegarde non vérifiée n'est pas une sauvegarde.

- Branche Neon : ouvrir la branche et lancer `db:status` avec son URL ; les
  volumes doivent correspondre à l'étape 0.
- Dump : `pg_restore --list` doit lister les tables attendues.

### Étape 3 — Confirmer qu'il y a bien quelque chose à appliquer

```bash
npm run db:status
```

- `0` en attente → rien à faire, s'arrêter ici (ou lancer `db:migrate:prod`
  uniquement pour la revérification, sans écriture).
- `N` en attente → passer à l'étape 4.

### Étape 4 — Appliquer

```bash
BACKUP_REFERENCE="neon:br-xxxx (2026-10-28)" npm run db:migrate:prod -- --confirm=APPLY
```

Le script affiche l'état **avant**, la référence de sauvegarde, applique les
migrations dans une transaction Drizzle, puis affiche l'état **après**.

Codes de sortie :

| Code | Signification |
| --- | --- |
| `0` | Migrations appliquées (ou déjà à jour) et invariants vérifiés |
| `1` | Refus d'un garde-fou, échec SQL, ou vérification finale en échec |

### Étape 5 — Vérifications post-migration

```bash
npm run db:status
npm run db:check:warehouses
```

Attendu :

- `Migrations : N/N appliquée(s), 0 en attente` ;
- `Multi-entrepôt: schéma présent` ;
- `Transferts : schéma présent` ;
- `Invariants : OK` ;
- volumes identiques à l'étape 0, **sauf** les tables nouvellement créées
  (`warehouses`, `warehouse_stock`, etc.) qui se remplissent par backfill.

Puis, côté application :

```bash
curl https://<domaine>/api/health
```

Attendu : `200` avec `"status":"ok"`, `"db":"ok"`, `"config":"ok"`.

Enfin, faire un parcours fonctionnel minimal en production : connexion,
ouverture du tableau de bord, ouverture d'un produit, création d'un mouvement de
stock de test puis vérification dans l'historique.

---

## 5. Ce que le script ne fait pas

- Il ne crée **pas** la sauvegarde : c'est une décision humaine, tracée dans
  `BACKUP_REFERENCE`.
- Il ne déploie pas l'application.
- Il ne restaure pas automatiquement en cas d'échec après migration.
- Il n'exécute pas `db:seed` (données de démonstration interdites en production).
- Il ne migre pas une base dont le schéma est déjà partiel : ce cas exige une
  intervention manuelle ou une restauration.

---

## 6. Restauration / rollback

### Cas 1 — La migration a échoué avant de valider (transaction annulée)

Drizzle exécute les migrations dans une transaction : un échec SQL annule
l'ensemble. Vérifier avec `db:status`, corriger la cause, relancer.

### Cas 2 — La migration est passée mais les invariants sont en échec

1. **Ne pas** relancer de migration ni « corriger » à la main en production.
2. Restaurer la branche Neon de sauvegarde :
   - console Neon → branche de production → **Restore** / promotion de la
     branche de sauvegarde, ou recréation de la branche principale depuis la
     sauvegarde selon la procédure Neon en vigueur ;
   - mettre à jour `DATABASE_URL` si l'endpoint change ;
   - redéployer si nécessaire.
3. Vérifier `db:status` sur la base restaurée.
4. Analyser la migration en local sur `stockely_test` avant toute nouvelle
   tentative.

### Cas 3 — Restauration depuis un dump

```bash
# Sur une base vide dédiée uniquement
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" stockely-20261028-avant-migration.dump
```

`pg_restore --clean` **supprime les objets existants**. Ne l'utiliser qu'après
sauvegarde et sur une base identifiée sans ambiguïté.

### Ce qu'un rollback ne fait pas

Revenir au schéma précédent ne « défait » pas les écritures applicatives déjà
acceptées après la migration. En cas de rollback, prévenir les utilisateurs et
vérifier la cohérence des données reprises.

---

## 7. Journal de migration

Tenir un journal hors dépôt (ou dans le ticket d'exploitation) avec :

- date et heure UTC ;
- base et branche ciblées ;
- migrations appliquées (`N` → `M`) ;
- référence de sauvegarde (`BACKUP_REFERENCE`) ;
- sortie de `db:status` avant et après ;
- résultat de `db:check:warehouses` ;
- personne ayant exécuté la commande.

### Historique connu

| Date (UTC) | Base | Résultat |
| --- | --- | --- |
| 2026-10-27T10:35:48Z | `stockely` (production) | 5/5 migrations appliquées, invariants OK |

> La production est déjà à jour. `db:migrate:prod` doit donc afficher
> « Aucune migration en attente » tant qu'aucune nouvelle migration n'est
> générée.

---

## 8. Ajouter une nouvelle migration

1. Modifier `src/server/db/schema.ts`.
2. `npm run db:generate` → nouvelle migration dans `drizzle/`.
3. Relire le SQL : aucune suppression de colonne/table sans plan de reprise,
   aucun `DROP` non justifié, backfill idempotent.
4. Appliquer sur `stockely_test` via `npm run db:migrate:test`.
5. Lancer `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
6. Vérifier `npm run db:status` et `npm run db:check:warehouses` sur la base de
   test.
7. Suivre la procédure de ce document pour la production.
