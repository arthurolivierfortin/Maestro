# Phase 40-PRE-F : Pipeline de Generation Pixel Art

**Statut** : A faire
**Prerequis** : Phase 40-PRE-D COMPLETE (first-run experience)
**Objectif** : Ajouter un provider d'image generation (Stable Diffusion) dans LLM-Provider et creer un tool block Maestro capable de generer du pixel art 2-3 couleurs avec style consistent.

---

## Contexte & Motivation

Maestro a besoin d'assets visuels : mascotte, icones, sprites d'animation, splash screens. Le style vise est celui du Flipper Zero — pixel art basse resolution, 2-3 couleurs, contours nets, esthetique retro.

Generer ces assets manuellement est lent et requiert des competences en pixel art. Un agent Maestro equipe d'un outil de generation pixel art pourrait :
1. Generer les sprites de la mascotte Maestro (maestro conductor)
2. Maintenir la coherence visuelle entre les differentes poses/animations
3. Etre reutilise pour Cantante (pochettes, icones) et toute future app Maestro
4. Servir de demonstation : un agent Maestro qui utilise des outils specialises (pas que du texte)

**Inspiration** : Le Flipper Zero utilise du pixel art fait main par des graphistes. Nous, on automatise ca avec un pipeline IA + post-processing + cleanup.

---

## Architecture

### Ou ca vit dans Maestro

```
llm-provider/
  api/                          ← Python FastAPI (DEJA GPU/PyTorch)
    endpoints/
      image_generate.py         ← NOUVEAU: endpoint generation image
    services/
      stable_diffusion.py       ← NOUVEAU: service SD + LoRA
      pixel_quantizer.py        ← NOUVEAU: post-processing 2-3 couleurs
    models/
      pixel-art-lora/           ← NOUVEAU: LoRA fine-tune pour style Maestro
  dotnet/
    src/
      LLMProvider.Web/
        Controllers/
          ImageController.cs    ← NOUVEAU: proxy vers Python /image/generate

packages/tui/
  tools/
    bitmap-preview.ts           ← EXISTE: preview PNG avec grille
    bitmap-import.ts            ← EXISTE: import PNG → bitmap text

content/system/blocks/tools/
  pixel-art-generator/
    pixel-art-generator.block.json  ← NOUVEAU: block outil
    system-prompt.md                ← NOUVEAU: instructions pour l'agent
```

### Flux de generation

```
Agent Maestro (ou utilisateur)
  │
  ├─ appelle le block "pixel-art-generator" avec:
  │   - description: "maestro conductor face, round glasses, walrus mustache"
  │   - palette: 2 ou 3 couleurs
  │   - dimensions: 32x32 ou 64x64
  │   - style_ref: "maestro-v1" (reference LoRA)
  │   - seed: optionnel (pour reproductibilite)
  │
  └→ Block execute:
      1. POST llm-provider:5010/api/v1/image/generate
      2. LLM-Provider .NET proxie vers Python FastAPI
      3. Python: Stable Diffusion + LoRA → image 512x512
      4. Python: resize nearest-neighbor → 32x32 ou 64x64
      5. Python: quantize en 2-3 couleurs (palette fixe)
      6. Python: export bitmap text format ('#'/'+'/'.')
      7. Retour au block → output = bitmap string

Agent recoit le bitmap, peut:
  - L'afficher dans le TUI (via renderBitmap)
  - Le sauvegarder dans un fichier sprite
  - Le modifier pixel par pixel
  - Regenerer avec un seed different
```

### Style Consistency

Le probleme #1 de la generation IA pour du pixel art : chaque generation produit un style different. Solutions :

1. **LoRA fine-tune** (RECOMMANDE) :
   - Entrainer un LoRA sur ~20-30 exemples du style vise
   - Exemples = sprites Flipper Zero + nos sprites manuels
   - Le LoRA force le modele a generer dans CE style precis
   - Fichier LoRA ~4-8 MB, charge une fois au startup

2. **Prompt engineering** (COMPLEMENTAIRE) :
   - Prefix fixe : "low-res pixel art, 2-color monochrome, chunky pixels, retro handheld sprite, crisp edges, no antialiasing"
   - Negative prompt : "smooth, blurry, gradient, 3D, realistic, antialiased"
   - CFG scale eleve (12-15) pour forcer le style

3. **Post-processing deterministe** (OBLIGATOIRE) :
   - Resize nearest-neighbor (pas bilinear — garde les pixels nets)
   - Quantize couleurs avec palette FIXE (ex: noir + cyan, ou noir + orange)
   - Optional: morphological cleanup (retirer pixels isoles)

4. **Seed management** :
   - Sauvegarder le seed de chaque generation reussie
   - Regenerer avec seed+1 pour variations coherentes
   - Library de "bons seeds" par type de sprite

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-40-PRE/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier Maestro backend** — tout le provider est dans llm-provider/
5. **Ne PAS hardcoder des prompts dans du C#** — tout passe par le block JSON
6. **Tester chaque etape isolement** — SD endpoint, quantizer, block, agent

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 42-A | Setup Stable Diffusion dans LLM-Provider Python API | 3-5 jours |
| 42-B | LoRA fine-tune pour style Maestro pixel art | 2-3 jours |
| 42-C | Post-processing pipeline (quantize, resize, bitmap export) | 1-2 jours |
| 42-D | Endpoint .NET proxy + block tool Maestro | 2-3 jours |
| 42-E | Integration agent + generation mascotte Maestro | 2-3 jours |

**Effort total** : 10-16 jours

---

## 42-A : Setup Stable Diffusion dans LLM-Provider Python API

### Ce que cette sous-phase fait
1. Installer `diffusers`, `accelerate`, `safetensors` dans l'environnement Python
2. Choisir un checkpoint de base (SD 1.5 ou SDXL selon VRAM disponible)
3. Creer le service `stable_diffusion.py` avec: load model, generate image, unload
4. Creer l'endpoint `POST /image/generate` dans FastAPI
5. Tester avec des prompts generiques

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `llm-provider/api/requirements.txt` | Ajouter diffusers, accelerate, safetensors |
| `llm-provider/api/services/stable_diffusion.py` | Creer: service SD avec load/generate/config |
| `llm-provider/api/endpoints/image_generate.py` | Creer: endpoint POST /image/generate |
| `llm-provider/api/main.py` | Modifier: enregistrer le nouveau router |

### API Contract
```
POST /image/generate
{
  "prompt": "pixel art elderly conductor, round glasses, bald, mustache",
  "negative_prompt": "smooth, blurry, gradient, 3D, realistic",
  "width": 512,
  "height": 512,
  "steps": 30,
  "cfg_scale": 12,
  "seed": 42,             // optionnel, -1 = random
  "lora": "maestro-v1",   // optionnel, nom du LoRA
  "lora_weight": 0.8      // optionnel, poids du LoRA
}

Response: {
  "image_base64": "...",   // PNG base64
  "seed": 42,              // seed utilise (pour reproductibilite)
  "metadata": { ... }
}
```

### Verification
```bash
# Demarrer le Python API
cd C:\Meastro\llm-provider\api && python -m uvicorn main:app --port 8000

# Tester la generation
curl -X POST http://localhost:8000/image/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"pixel art robot", "width":512, "height":512, "steps":20}'
# Resultat attendu : JSON avec image_base64 non-vide

# Verifier que le health check fonctionne toujours
curl http://localhost:8000/health
# Resultat attendu : {"status": "ok"}
```

### Anti-patterns
- Ne PAS charger le modele SD a chaque requete — le garder en memoire GPU
- Ne PAS utiliser SDXL si la machine a < 12GB VRAM — utiliser SD 1.5
- Ne PAS bloquer le endpoint LLM pendant la generation image — utiliser un worker separe ou async

---

## 42-B : LoRA fine-tune pour style Maestro pixel art

### Ce que cette sous-phase fait
1. Collecter 20-30 images de reference (sprites Flipper Zero, nos bitmaps manuels)
2. Preparer le dataset (captions, cropping, resolution)
3. Fine-tuner un LoRA avec `kohya-ss` ou `diffusers` training
4. Tester le LoRA sur 10+ prompts pour verifier la coherence
5. Sauvegarder le LoRA dans `llm-provider/api/models/pixel-art-lora/`

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `llm-provider/api/models/pixel-art-lora/maestro-v1.safetensors` | Creer: fichier LoRA entraine |
| `llm-provider/api/models/pixel-art-lora/training-config.json` | Creer: config d'entrainement (pour reproductibilite) |
| `llm-provider/api/models/pixel-art-lora/dataset/` | Creer: images + captions d'entrainement |
| `llm-provider/api/services/stable_diffusion.py` | Modifier: support chargement LoRA |

### Verification
```bash
# Generer 5 images avec LoRA
for seed in 1 2 3 4 5; do
  curl -X POST http://localhost:8000/image/generate \
    -d "{\"prompt\":\"pixel art conductor\", \"lora\":\"maestro-v1\", \"seed\":$seed}"
done
# Resultat attendu : 5 images avec un style coherent et reconnaissable
```

### Anti-patterns
- Ne PAS entrainer trop longtemps (overfitting) — 500-1000 steps suffisent pour un LoRA
- Ne PAS utiliser des images de resolution differente dans le dataset — normaliser a 512x512
- Ne PAS ignorer les captions — chaque image DOIT avoir une description precise

---

## 42-C : Post-processing pipeline (quantize, resize, bitmap export)

### Ce que cette sous-phase fait
1. Creer `pixel_quantizer.py` : resize nearest-neighbor + quantize 2-3 couleurs
2. Supporter les palettes : 2-color (outline/bg), 3-color (outline/fill/bg)
3. Exporter en format bitmap text ('#'/'+'/'.') compatible avec notre `renderBitmap`
4. Cleanup optionnel : retirer pixels isoles (bruit), fermer contours ouverts

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `llm-provider/api/services/pixel_quantizer.py` | Creer: resize + quantize + bitmap export |
| `llm-provider/api/endpoints/image_generate.py` | Modifier: ajouter post-processing optionnel |

### API Contract etendu
```
POST /image/generate
{
  ...existant...,
  "post_process": {
    "target_width": 32,        // resize dimensions
    "target_height": 32,
    "palette_size": 2,         // 2 ou 3 couleurs
    "cleanup": true,           // retirer bruit
    "output_format": "bitmap"  // "bitmap" | "png" | "both"
  }
}

Response (quand output_format = "bitmap"):
{
  "bitmap": [                  // array de strings, notre format
    "................................",
    "..........########..............",
    ...
  ],
  "image_base64": "...",       // PNG original aussi
  "seed": 42
}
```

### Verification
```bash
# Generer avec post-processing bitmap
curl -X POST http://localhost:8000/image/generate \
  -d '{"prompt":"pixel art face", "lora":"maestro-v1", "post_process":{"target_width":32,"target_height":32,"palette_size":2,"output_format":"bitmap"}}'
# Resultat attendu : JSON avec "bitmap" = array de 32 strings de 32 chars chacun
```

### Anti-patterns
- Ne PAS utiliser bilinear/bicubic resize — TOUJOURS nearest-neighbor pour pixel art
- Ne PAS quantizer avant le resize — resize d'abord, quantize ensuite
- Ne PAS hardcoder les couleurs de la palette — les passer en parametre

---

## 42-D : Endpoint .NET proxy + block tool Maestro

### Ce que cette sous-phase fait
1. Creer `ImageController.cs` dans LLM-Provider .NET qui proxie vers Python
2. Creer le block `pixel-art-generator.block.json` dans Maestro
3. Le block appelle l'API via HTTP et retourne le bitmap
4. Tester le block via `maestro run pixel-art-generator`

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `llm-provider/dotnet/src/LLMProvider.Web/Controllers/ImageController.cs` | Creer: proxy vers Python /image/generate |
| `content/system/blocks/tools/pixel-art-generator/pixel-art-generator.block.json` | Creer: block definition |
| `content/system/blocks/tools/pixel-art-generator/system-prompt.md` | Creer: instructions pour l'agent |

### Verification
```bash
# Via LLM-Provider .NET (port 5010)
curl -X POST http://localhost:5010/api/v1/image/generate \
  -d '{"prompt":"pixel art conductor", "post_process":{"target_width":32,"target_height":32,"palette_size":2,"output_format":"bitmap"}}'
# Resultat attendu : meme reponse que le Python, proxied

# Via Maestro CLI
node index.js run pixel-art-generator --input prompt="pixel art conductor face" --input width=32
# Resultat attendu : bitmap output dans le terminal
```

### Anti-patterns
- Ne PAS ajouter de logique image dans Maestro backend — tout reste dans LLM-Provider
- Ne PAS creer un nouveau gateway dans Maestro — utiliser le LLMProviderGateway existant ou un ImageProviderGateway minimal
- Ne PAS hardcoder des prompts dans le block executor C# — le prompt vient de l'input

---

## 42-E : Integration agent + generation mascotte Maestro

### Ce que cette sous-phase fait
1. Creer un agent "visual-designer" qui utilise le tool pixel-art-generator
2. L'agent prend une description et genere plusieurs variantes
3. Generer la mascotte Maestro definitive (5 etats x 2 frames)
4. Generer le splash screen
5. Integrer les sprites dans `packages/tui/sprites/mascotte.ts`
6. Mettre a jour tous les tests

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `content/system/blocks/agents/visual-designer/` | Creer: agent qui utilise pixel-art-generator |
| `packages/tui/sprites/mascotte.ts` | Modifier: remplacer par sprites generes par l'agent |
| `packages/tui/tests/mascotte.test.ts` | Modifier: adapter aux nouveaux sprites |

### Verification
```bash
# L'agent genere 3 variantes de la mascotte
node index.js run visual-designer --input task="Generate 3 variants of the Maestro conductor face, 32x32, 2-color"
# Resultat attendu : 3 bitmaps differents mais stylistiquement coherents

# Tests
cd packages/tui && npx vitest run tests/mascotte.test.ts
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent
```

### Anti-patterns
- Ne PAS generer des sprites sans les valider visuellement — toujours preview
- Ne PAS utiliser des seeds aleatoires pour les sprites finaux — documenter les seeds
- Ne PAS remplacer les sprites existants sans backup — garder l'ancien dans un commentaire ou fichier separe

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-40-PRE/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 42 — Pixel art pipeline: SD in LLM-Provider Python, LoRA maestro-v1, pixel-art-generator block, visual-designer agent"
- Ajouter : "Image generation endpoint: POST /api/v1/image/generate (LLM-Provider .NET proxy → Python FastAPI)"

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| VRAM insuffisante pour SD | Bloquant | Utiliser SD 1.5 (4GB) au lieu de SDXL (12GB). Ou: offload CPU |
| LoRA ne converge pas | Style inconsistant | Augmenter dataset (30→50 images), ajuster learning rate |
| Quantization perd trop de details | Sprites illisibles | Generer a 64x64 puis downscale. Ou: 3 couleurs au lieu de 2 |
| Latence generation (30s+) | UX lente | Cache des generations. Batch processing. Pre-generate au build time |
| Le style ne "colle" pas | Deception visuelle | Pipeline hybride : IA genere brouillon, humain cleanup final |

---

## Dependances techniques

- **GPU** : NVIDIA avec CUDA (la machine de dev a deja ca pour le Python API local)
- **VRAM** : 4GB minimum (SD 1.5), 8GB+ recommande
- **Python** : diffusers >= 0.25, torch >= 2.0, Pillow
- **Disk** : ~2-4GB pour le checkpoint SD + LoRA
