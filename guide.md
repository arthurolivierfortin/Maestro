

# 🧭 Ce que cette phase DOIT réellement accomplir

Cette phase n’est **pas** “ajouter une feature de plus”.
C’est une **phase fondationnelle** qui introduit **l’isolement par repo**, **l’exécution sécurisée**, et **l’unification des points d’entrée** (Frontend / CLI / MCP / Agents).

👉 Si elle est mal pensée, **tout l’auto-training et l’autonomie par repo deviennent impossibles**.

---

## 🎯 But réel de la phase (formulation claire)

> Permettre à un repository d’avoir :
>
> * ses propres blocs
> * ses propres agents
> * son propre contexte d’exécution
> * des accès strictement limités (filesystem, tools, réseau)
>   tout en utilisant **le même moteur backend**, indépendamment de l’UI utilisée.

---

# 🧩 Concepts à verrouiller AVANT d’implémenter


---

## 1️⃣ Le concept clé : **Project = Unité d’exécution isolée**

Un **Project** représente :

* un repo (ou workspace)
* un dossier `.maestro/`
* un container (ou sandbox)
* un scope de sécurité
* un namespace de blocs

> 👉 **Un Project = une boundary de confiance**

---

## 2️⃣ Structure cible (proposition claire)

### 📁 Dans un repo utilisateur

```txt
my-repo/
├─ .maestro/
│  ├─ project.json
│  ├─ blocks/
│  │  ├─ workflows/
│  │  ├─ tools/
│  │  ├─ agents/
│  │  └─ scripts/
│  ├─ runs/
│  └─ cache/
├─ src/
└─ README.md
```

### `project.json`

```json
{
  "id": "my-repo",
  "runtime": {
    "container": "maestro-node",
    "network": false,
    "filesystem": "repo-only"
  }
}
```

👉 **C’est ce fichier qui permet au backend de savoir :**

* où exécuter
* avec quelles permissions
* avec quels blocks

---

## 3️⃣ Où vont les blocks ? (décision CRITIQUE)

Tu as très bien identifié un bug conceptuel :

> ❌ Les blocks globaux sont créés dans `Maestro.Api/.maestro`

👉 **C’est une erreur architecturale**, pas juste un bug.

### ✅ Règle saine

| Type de block       | Emplacement              |
| ------------------- | ------------------------ |
| Core / système      | Backend (non modifiable) |
| Globaux utilisateur | `~/.maestro/blocks`      |
| Par projet          | `<repo>/.maestro/blocks` |

👉 **Le frontend ne crée JAMAIS de blocks dans le backend**.

---

## 4️⃣ Backend : un seul moteur, plusieurs Projects

❌ Copier le backend dans chaque repo → **NON**

### ✅ Architecture correcte

* **1 backend**
* **N projects**
* chaque requête inclut :

  * `projectId`
  * `projectRoot`

Le backend :

* monte le container
* charge les blocks du project
* applique les règles de sécurité

---

## 5️⃣ Frontend : ce qu’il doit faire (et ne pas faire)

### Le frontend NE DOIT PAS :

* décider de la sécurité
* exécuter quoi que ce soit
* interpréter les scripts

### Le frontend DOIT :

* lister les projects
* afficher leur filesystem logique
* permettre :

  * créer blocs
  * éditer fichiers
  * lancer workflows

👉 Exactement la **même logique** que le CLI et le MCP.

---

## 6️⃣ Foundry = vue d’édition, pas un mode spécial

Très important :

> La Foundry **n’est pas un mode à part**.

Elle est juste :

* un client
* qui écrit dans le filesystem
* via le backend

👉 Si un utilisateur :

* crée un block via VSCode
* ou via CLI
* ou via UI

➡️ **Le résultat est strictement identique**

---

## 7️⃣ Containers : comment les introduire sans exploser la complexité

### Phase 

* container **par project**
* image choisie dans une liste
* accès limité :

  * repo
  * outils autorisés

### autre implémentation à prévoire pour plus tard

* isolation réseau fine
* cache partagé
* GPU / LLM remote


---

# 🧱 Exemple de phase interne (Vous pouvez l'améliorer)


### Phase A — Correctifs

* Corriger l’emplacement des blocks globaux
* Nettoyer la logique de discovery

### Phase B — Project Model

* définir `Project`
* définir `project.json`
* backend supporte `projectId`

### Phase C — Filesystem unifié

* backend = source de vérité
* frontend / CLI / MCP utilisent les mêmes endpoints

### Phase D — Container runtime

* associer project → container
* exécuter tools / scripts dedans

### Phase E — Frontend page “Projects”

* créer / ouvrir project
* voir blocks
* exécuter workflows

---


