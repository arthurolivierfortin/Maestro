# Model Capability Test Template

> **Objectif** : Ce template guide le testeur pour évaluer les capacités d'un modèle LLM spécifique.
> Les tests utilisent des blocs inference directement pour mesurer les performances brutes du modèle.

---

## Information de Session

**Date du test :** _______________
**Testeur (Authority) :** _______________
**Modèle testé :** _______________
**Version du modèle :** _______________

**Configuration matérielle :**
- GPU : _______________
- VRAM disponible : _______________
- Quantization : [ ] FP16  [ ] INT8  [ ] INT4

**URLs des services :**
- Backend : http://localhost:5000
- LLM-Provider : http://localhost:8000

---

## Checklist Pré-Test

- [ ] LLM-Provider service accessible
- [ ] Modèle chargé et actif
- [ ] Backend service accessible
- [ ] Bloc inference disponible

**Commande de vérification :**
```bash
node C:\Meastro\tools\maestro-cli\index.js llm
```

**Résultat :**
```

```

---

# PHASE 1 : Tests de Format de Sortie

## Test 1.1 : JSON Simple

**Objectif :** Vérifier que le modèle peut produire du JSON valide.

**Prompt :**
```
Output a JSON object with two keys: "name" (string) and "age" (number). Example: {"name": "John", "age": 30}
```

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js run llm-generate --input 'prompt=Output a JSON object with two keys: "name" (string) and "age" (number). Example: {"name": "John", "age": 30}' --input 'model=MODEL_ID'
```

**Résultat attendu :** JSON valide avec structure {"name": "...", "age": ...}

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] JSON valide
- [ ] Structure correcte
- [ ] Pas de texte superflu

**Score :** ___/10

---

## Test 1.2 : JSON Complexe (Nested)

**Objectif :** Vérifier la capacité à produire du JSON imbriqué.

**Prompt :**
```
Output a JSON object representing a person with: name (string), age (number), address (object with street and city), hobbies (array of strings). Output ONLY the JSON, no explanation.
```

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] JSON valide
- [ ] Objets imbriqués corrects
- [ ] Array correcte
- [ ] Pas de texte superflu

**Score :** ___/10

---

## Test 1.3 : Format Tool Call

**Objectif :** Vérifier la capacité à produire le format d'appel d'outil Maestro.

**Prompt :**
```
You must output ONLY a JSON object to call a tool. Format: {"tool": "tool_name", "args": {"key": "value"}}
Call the tool "list_files" with argument "path" set to "/home/user".
Output ONLY the JSON, nothing else.
```

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] Format {"tool": ..., "args": ...} respecté
- [ ] Nom du tool correct
- [ ] Arguments corrects
- [ ] Pas de texte avant/après

**Score :** ___/10

---

## Test 1.4 : Markdown Structuré

**Objectif :** Vérifier la capacité à produire du Markdown bien formaté.

**Prompt :**
```
Write a brief documentation with: a title (h1), an introduction paragraph, a bullet list of 3 items, and a code block with "hello world" in Python.
```

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] Titre H1 présent
- [ ] Paragraphe d'introduction
- [ ] Liste à puces (3 items)
- [ ] Code block Python

**Score :** ___/10

---

# PHASE 2 : Tests d'Instruction Following

## Test 2.1 : Instructions Simples

**Objectif :** Vérifier que le modèle suit des instructions directes.

**Prompt :**
```
Count from 1 to 5, each number on a new line. Nothing else.
```

**Résultat attendu :**
```
1
2
3
4
5
```

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 2.2 : Contraintes Négatives

**Objectif :** Vérifier que le modèle respecte les interdictions.

**Prompt :**
```
List 3 colors. Do NOT include red or blue.
```

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] 3 couleurs listées
- [ ] Pas de rouge
- [ ] Pas de bleu

**Score :** ___/10

---

## Test 2.3 : Instructions Multi-Étapes

**Objectif :** Vérifier la capacité à suivre une séquence d'instructions.

**Prompt :**
```
Follow these steps exactly:
1. Write "START"
2. List the vowels (a, e, i, o, u)
3. Write "END"
```

**Résultat attendu :**
```
START
a, e, i, o, u
END
```

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 2.4 : Extraction d'Information

**Objectif :** Vérifier la capacité à extraire des informations spécifiques.

**Prompt :**
```
Extract the email from this text and output ONLY the email, nothing else:
"Contact John at john.doe@example.com for more information about the project."
```

**Résultat attendu :** `john.doe@example.com`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

# PHASE 3 : Tests de Mémoire/Contexte

## Test 3.1 : Référence au Contexte Récent

**Objectif :** Vérifier que le modèle utilise le contexte fourni.

**System Prompt :**
```
The user's name is Alice and she lives in Paris.
```

**User Prompt :**
```
What is my name and where do I live? Answer in one sentence.
```

**Résultat attendu :** Mention de "Alice" et "Paris"

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 3.2 : Information dans le Prompt

**Objectif :** Vérifier que le modèle lit et utilise les informations du prompt.

**Prompt :**
```
The project is located at C:/Projects/MyApp.
The main file is called "app.py".

What is the full path to the main file?
```

**Résultat attendu :** `C:/Projects/MyApp/app.py`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 3.3 : Variables dans le Contexte

**Objectif :** Vérifier la substitution de variables.

**Prompt :**
```
Given:
- PROJECT_PATH = /home/user/project
- FILE_NAME = config.json

Output the command to read this file using cat. Format: cat [full_path]
```

**Résultat attendu :** `cat /home/user/project/config.json`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

# PHASE 4 : Tests de Raisonnement

## Test 4.1 : Logique Simple

**Objectif :** Vérifier le raisonnement logique de base.

**Prompt :**
```
If A > B and B > C, is A > C? Answer with just "Yes" or "No".
```

**Résultat attendu :** `Yes`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 4.2 : Mathématiques Simples

**Objectif :** Vérifier les capacités de calcul.

**Prompt :**
```
Calculate: 15 + 27 = ?
Output only the number.
```

**Résultat attendu :** `42`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 4.3 : Compréhension de Code

**Objectif :** Vérifier la compréhension de code simple.

**Prompt :**
```
What does this Python code output?
x = 5
y = 3
print(x + y)

Answer with just the output.
```

**Résultat attendu :** `8`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

# PHASE 5 : Tests de Performance Agent

## Test 5.1 : Flux Tool Call Complet

**Objectif :** Simuler un flux d'agent complet.

**System Prompt :**
```
You are a task executor. Output ONLY JSON.
Available tools:
- list_files: {"tool":"list_files","args":{"path":"..."}}
- done: {"tool":"done","args":{"summary":"..."}}

After receiving tool results, call done with a summary.
```

**User Prompt :**
```
List the files in /project
```

**Résultat attendu (Iteration 1) :** `{"tool":"list_files","args":{"path":"/project"}}`

**Résultat obtenu :**
```

```

**Simulated Tool Result :**
```
file1.txt, file2.py, README.md
```

**Résultat attendu (Iteration 2) :** `{"tool":"done","args":{"summary":"..."}}`

**Résultat obtenu :**
```

```

**Analyse :**
- [ ] Format tool call correct (iteration 1)
- [ ] Appel done après résultat
- [ ] Pas de boucle infinie
- [ ] Summary cohérent

**Score :** ___/10

---

## Test 5.2 : Gestion d'Erreur

**Objectif :** Vérifier la réaction aux erreurs.

**Prompt (après tool error) :**
```
Tool result for list_files:
Error: Directory not found: /invalid/path

What should you do next? Output as JSON tool call.
```

**Résultat attendu :** Soit retry avec autre path, soit done avec erreur

**Résultat obtenu :**
```

```

**Score :** ___/10

---

# PHASE 6 : Tests de Limites

## Test 6.1 : Longueur de Réponse

**Objectif :** Vérifier la capacité à produire des réponses longues.

**Prompt :**
```
Write exactly 5 paragraphs about programming, each starting with "Paragraph X:".
```

**Résultat obtenu :**
```

```

**Analyse :**
- Nombre de paragraphes : ___/5
- Format respecté : [ ] Oui  [ ] Non

**Score :** ___/10

---

## Test 6.2 : Réponse Courte

**Objectif :** Vérifier la capacité à être concis.

**Prompt :**
```
What is 2+2? One word answer only.
```

**Résultat attendu :** `4` ou `Four`

**Résultat obtenu :**
```

```

**Score :** ___/10

---

## Test 6.3 : Caractères Spéciaux

**Objectif :** Vérifier la gestion des caractères spéciaux.

**Prompt :**
```
Output this exact string: C:\Users\test\file.txt
```

**Résultat obtenu :**
```

```

**Score :** ___/10

---

# RÉSUMÉ DES CAPACITÉS

## Scores par Catégorie

| Catégorie | Score | Max |
|-----------|-------|-----|
| Format de Sortie (JSON, Markdown) | ___/40 | 40 |
| Instruction Following | ___/40 | 40 |
| Mémoire/Contexte | ___/30 | 30 |
| Raisonnement | ___/30 | 30 |
| Performance Agent | ___/20 | 20 |
| Tests de Limites | ___/30 | 30 |
| **TOTAL** | ___/190 | 190 |

## Pourcentage Global : ____%

---

## Classification

| Score | Classification | Recommandation |
|-------|---------------|----------------|
| 170-190 | Excellent | Recommandé pour agents complexes |
| 140-169 | Bon | Utilisable pour agents simples |
| 100-139 | Moyen | Utilisable pour tâches spécifiques |
| 60-99 | Faible | Non recommandé pour agents |
| <60 | Insuffisant | Non utilisable |

**Classification du modèle :** _______________

---

## Capacités Confirmées

- [ ] JSON Output valide
- [ ] Tool Calling format
- [ ] Instruction Following
- [ ] Context Awareness
- [ ] Multi-step Reasoning
- [ ] Error Handling
- [ ] Concise Responses
- [ ] Long-form Responses

---

## Capacités Manquantes/Problèmes

| Capacité | Problème Observé | Impact |
|----------|------------------|--------|
| | | |
| | | |
| | | |

---

## Recommandations d'Usage

**Cas d'usage recommandés :**
```

```

**Cas d'usage non recommandés :**
```

```

**Configuration optimale suggérée :**
```json
{
  "temperature": ,
  "maxTokens": ,
  "topP":
}
```

---

# MÉTRIQUES DE PERFORMANCE

## Temps de Réponse

| Test | Temps (ms) |
|------|------------|
| JSON Simple | |
| Tool Call | |
| Raisonnement | |
| **Moyenne** | |

## Utilisation Ressources

- VRAM utilisée : ___ GB
- Temps de chargement : ___ s

---

# APPROBATION

**Testeur :**
Nom : _______________
Date : _______________

**Modèle certifié pour Maestro :** [ ] Oui  [ ] Non

**Raison (si non) :**
```

```
