# Issue 30-A-3 : Infrastructure for-each sur donnees dynamiques

**Statut** : COMPLETE (2026-02-17)
**Estimation** : 1 heure
**Bloquant** : Bloque 30-C (le composite utilise for-each sur le plan)
**Prerequis** : Aucun

---

## Description

Le noeud `for-each` dans `EntryPointExecutor` lit une variable de session qui doit etre une liste. Probleme : quand le noeud precedent (ex: `task-planner`) produit un JSON array comme sortie, cette sortie est stockee dans `_nodeResult_plan` comme **string** (la sortie brute du LLM), pas comme une liste d'objets.

Le for-each handler doit etre capable de parser cette string en liste si elle contient un JSON array valide.

---

## Tache detaillee

### Option A : Parser dans le for-each handler (recommandee — minimal)

Dans `EntryPointExecutor.ExecuteForEachNodeAsync()`, apres avoir lu la variable source :

```csharp
// Lire la variable source
var sourceValue = session.GetVariable(sourceVarName);

// Si c'est un string qui ressemble a un JSON array, tenter le parsing
if (sourceValue is string sourceStr)
{
    var trimmed = sourceStr.Trim();
    if (trimmed.StartsWith("["))
    {
        try
        {
            sourceValue = JsonSerializer.Deserialize<List<object>>(trimmed);
        }
        catch (JsonException)
        {
            // Pas un JSON valide — garder comme string
            // Le for-each echouera naturellement avec un message d'erreur clair
        }
    }
}
```

### Option B : Noeud `parse-json` (plus propre, plus de travail)

Ajouter un nouveau type de noeud dans `config.nodes` :

```json
{
  "id": "parse-plan",
  "type": "parse-json",
  "source": "_nodeResult_plan",
  "target": "_planSteps"
}
```

Ce noeud lit une variable string, parse le JSON, et stocke le resultat comme une vraie liste dans une nouvelle variable.

**Avantage** : plus explicite, separation des responsabilites.
**Inconvenient** : plus de code a ecrire, un nouveau type de noeud a supporter.

### Decision

Implementer **Option A** d'abord (minimal, debloque le composite). Si l'Option B est necessaire pour la clarte, l'implementer en 30-C quand le composite est assemble.

---

## Instructions de test

### Test 1 : for-each sur une string JSON valide

```bash
# Creer une session de test
node index.js session create --type project --name "for-each test" --start

# Setter une variable qui est un string contenant un JSON array
node index.js session set-var <id> testSteps '[{"id":1,"action":"create","target":"hello.ts"},{"id":2,"action":"create","target":"world.ts"}]'

# Creer un workflow minimal qui fait un for-each sur testSteps
# (necessaire : un bloc qui itere avec config.nodes de type for-each)

# Verifier dans les logs que le for-each itere 2 fois
```

### Test 2 : for-each sur une vraie sortie LLM

```bash
# Invoquer task-planner standalone
node index.js run task-planner --input task="Create a README.md" --input context="TypeScript project"

# La sortie doit etre un JSON array. Verifier que c'est parsable.
# Ensuite, injecter cette sortie dans une variable de session et tester le for-each.
```

### Test 3 : for-each sur une string non-JSON (cas d'erreur)

```bash
# Setter une variable qui est un string mais PAS du JSON
node index.js session set-var <id> badData "this is not json"

# Le for-each doit echouer proprement avec un message d'erreur clair
# PAS un crash, PAS une boucle infinie
```

---

## Critere de completion

- [ ] Le for-each handler parse automatiquement les strings JSON en listes
- [ ] Un for-each sur `[{"id":1}, {"id":2}]` (string) itere 2 fois
- [ ] Un for-each sur une liste native (pas string) continue de fonctionner
- [ ] Un for-each sur une string non-JSON echoue proprement (message d'erreur, pas de crash)
- [ ] `dotnet build` compile sans erreur
- [ ] Le fix n'impacte pas les for-each existants (compliance-tester, foundry-default)

---

## Risques

- **Risque** : Le parsing JSON transforme les items en `JsonElement` au lieu de `Dictionary<string, object>`
- **Mitigation** : Utiliser `NormalizeObjectValue()` apres le parsing (la meme fonction qui gere deja ce probleme pour les variables API)
- **Risque** : Le for-each existant (compliance-tester) casse apres le changement
- **Mitigation** : Tester les sessions existantes apres le fix

---

## Resolution (2026-02-17)

### Implementation : Option A (parsing dans le for-each handler)

Ajout d'un 3e cas dans `NormalizeJsonElementToList()` pour gerer les `string` contenant un JSON array. Cas existants :
1. `JArray` (Newtonsoft, depuis API) — deja gere
2. `JsonElement` avec `ValueKind.Array` (System.Text.Json, depuis block config) — deja gere
3. **NOUVEAU** : `string` commencant par `[` — parse via `JsonSerializer.Deserialize<JsonElement>`, puis convertit en `List<Dictionary<string,object>>` comme les deux autres cas

Le parsing utilise `TryGetInt32()` avant `GetDouble()` pour les nombres (preserve les entiers), et stringify les objets/arrays imbriques (pas de recursion profonde pour l'instant).

En cas de JSON invalide, `JsonException` est catchee silencieusement et la valeur reste un string — le for-each echouera avec son message d'erreur standard ("source is empty or not a list").

### Fichier modifie

`backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — methode `NormalizeJsonElementToList()`, apres le bloc `JsonElement`

### Verification

- `dotnet build` : 0 erreurs
- Les cas existants (JArray, JsonElement) ne sont pas impactes (le nouveau code est un 3e `if` apres les `return` des cas existants)
