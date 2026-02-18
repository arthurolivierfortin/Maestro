# Issue P5-A : Assess Foundry Gap + Documentation Update

**Priorite** : P5 (decision point)
**Estimation** : 1-2 heures
**Bloque** : Rien
**Bloque par** : Rien

---

## Probleme

`docs/guides/users/full-pipeline.md` decrit un systeme foundry ambitieux :

| Feature | Statut |
|---------|--------|
| `foundry draft create/edit/show/ready` | NON IMPLEMENTE |
| `foundry session create/start/metrics` | TEMPLATE EXISTE, pas de commandes CLI |
| Quality gate enforcement before approval | NON IMPLEMENTE (P3-B le corrige) |
| Version auto-increment | NON IMPLEMENTE |
| Improvement suggestion system | NON IMPLEMENTE |
| Workspace-foundry provenance tracking | NON IMPLEMENTE (P3-C le corrige partiellement) |
| Rejection feedback to source session | PARTIEL |

La majorite du workflow decrit dans `full-pipeline.md` n'est pas implementee. Le document donne l'impression que le systeme est beaucoup plus complet qu'il ne l'est.

---

## Decision a prendre

### Option A : Implementer le foundry complet (NON RECOMMANDE pour maintenant)

- Draft system, training iterations CLI, improvement suggestions, comparison
- Effort : 2-3 semaines supplementaires
- Risque : Retarde Phase 31 significativement pour des features qui n'ont pas ete necessaires jusqu'ici

### Option B : Marquer full-pipeline.md comme "vision future" (RECOMMANDE)

1. Ajouter un disclaimer en haut de `full-pipeline.md` :
   ```markdown
   > **Note**: This document describes the complete foundry vision.
   > The current implementation supports a simplified pipeline:
   > create block → test in session → publish → approve.
   > See `current-pipeline.md` for what's available today.
   ```

2. Creer `docs/guides/users/current-pipeline.md` avec le flow reel :
   - Create block (JSON + system-prompt.md)
   - Test via `session invoke` or `run`
   - Iterate prompts until quality is satisfactory
   - `block publish` → pending approval
   - `block approve` → published to catalog
   - Use in project sessions

3. Mettre a jour les references dans CLAUDE.md si necessaire

### Option C : Supprimer full-pipeline.md (NON RECOMMANDE)

- Perd la vision architecturale
- Les concepts sont bons, juste pas implementes

---

## Recommandation

**Option B**. Le foundry complet est un bon objectif long-terme, mais le flow simplifie (create → test → publish → approve) est suffisant pour Phase 31. Documenter honnement ce qui existe vs ce qui est planifie.

Les pieces manquantes (draft system, training CLI, suggestions) peuvent etre ajoutees incrementalement quand le besoin se fait sentir. Phase 30 a montre qu'on peut developper des blocs fonctionnels sans le foundry complet — mais on a AUSSI montre qu'on saute le publish/approve quand c'est trop complexe, ce qui valide le besoin de simplifier le flow documente.

---

## Tache

### 1. Ajouter disclaimer a full-pipeline.md

Un banner en haut du document indiquant clairement le statut d'implementation.

### 2. Creer current-pipeline.md

Documenter le flow reel, tel qu'il fonctionne aujourd'hui :

```markdown
# Current Block Development Pipeline

## 1. Create the block
- Write `{block-id}.{type}.block.json` + `system-prompt.md` (for agents/inference)
- Place in `content/system/blocks/{type}/{block-id}/`

## 2. Test the block
- Direct: `node index.js run <block-id> --input key=value`
- In session: `node index.js session invoke <session-id> <entry-point>`

## 3. Iterate
- Adjust prompts, model, inputs
- Re-test until satisfied

## 4. Publish
- `node index.js block publish <block-id> --version X.Y.Z`
- Block enters "pending approval" state

## 5. Review & Approve
- `node index.js block --pending-approval` to see pending blocks
- `node index.js block approve <approval-id>` to approve
- Block is now in the catalog

## 6. Use in production
- Reference the block by ID in workflows and session templates
- `node index.js catalog` to browse published blocks
```

### 3. Audit des references

Verifier que CLAUDE.md et les autres documents ne pointent pas vers des features non-implementees comme si elles existaient.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `docs/guides/users/full-pipeline.md` | Ajouter disclaimer "vision future" |
| `docs/guides/users/current-pipeline.md` | CREER — documenter le flow reel |
| `CLAUDE.md` | Verifier que les references sont correctes |

---

## Criteres de completion

- [ ] `full-pipeline.md` a un disclaimer clair indiquant que c'est une vision, pas l'etat actuel
- [ ] `current-pipeline.md` existe et decrit le flow reel en 6 etapes
- [ ] Aucun document ne donne l'impression que le foundry complet est implemente
- [ ] CLAUDE.md reference le bon document pour le flow de blocs
