# LoRA Fine-Tuning — Theorie et Application dans Maestro

## Le probleme : adapter un modele sans tout re-entrainer

Stable Diffusion 1.5 a **860 millions de parametres**. Pour lui apprendre un style visuel specifique (pixel art Maestro : 2-3 couleurs, contours nets, esthetique retro), on a trois options :

| Approche | Parametres a entrainer | Temps | VRAM | Fichier produit |
|----------|----------------------|-------|------|-----------------|
| Full fine-tune | 860M (100%) | Jours | 24GB+ | 4GB |
| Textual Inversion | ~1K (token embedding) | Heures | 8GB | 4KB |
| **LoRA** | **~40K (0.005%)** | **30-60 min** | **6GB** | **4-8MB** |

LoRA est le sweet spot : assez expressif pour apprendre un style complet, assez leger pour tourner sur notre GPU.

---

## Comment LoRA fonctionne

### Intuition

Un modele de diffusion est un empilement de couches lineaires. Chaque couche contient une matrice de poids `W` qui transforme les donnees. Fine-tuner = modifier ces matrices.

L'insight de LoRA : **l'ajustement necessaire pour un style est de faible dimensionnalite.** On n'a pas besoin de modifier les 860M de parametres — on peut capturer le changement avec beaucoup moins.

### La decomposition

Au lieu de modifier directement `W` (matrice `d x k`), LoRA ajoute un petit ajustement `ΔW` decompose en deux matrices :

```
ΔW = A × B

W_original : d × k     (ex: 1024 × 1024 = 1,048,576 parametres)
A           : d × r     (ex: 1024 × 4   = 4,096 parametres)
B           : r × k     (ex: 4 × 1024   = 4,096 parametres)
ΔW = A × B : d × k     (meme dimension que W, mais code par 8,192 parametres)

W_final = W_original + α × A × B
```

Le `r` est le **rang** — la dimensionnalite de l'ajustement. Plus petit = moins de parametres mais moins d'expressivite. `α` (alpha) est le facteur d'echelle qui controle l'intensite de l'adaptation.

### Pourquoi ca marche (mathematiquement)

C'est le meme principe que la **decomposition en valeurs singulieres (SVD)** : toute matrice peut etre approximee par un produit de matrices de rang inferieur.

Si la "difference" entre le modele generique et le modele specialise peut etre capturee par une matrice de rang `r`, alors LoRA est une approximation exacte. En pratique, pour un style visuel, `r = 4` suffit — le style est un signal de basse dimensionnalite dans l'espace des parametres.

C'est different de la regression lineaire, mais l'intuition est liee : dans les deux cas, on cherche la meilleure approximation de faible rang d'une relation lineaire.

```
Regression lineaire :  y = Wx + b        (trouver W qui minimise l'erreur)
LoRA :                 ΔW = AB            (trouver A, B tels que W + AB genere le bon style)
```

### Pendant l'entrainement

1. On **gele** tous les poids `W` du modele (ils ne bougent pas)
2. On initialise `A` aleatoirement (gaussien) et `B` a zero (donc `ΔW = 0` au depart)
3. On entraine UNIQUEMENT `A` et `B` sur notre dataset
4. Le gradient ne retro-propage que dans `A` et `B` — tres rapide

### Pendant l'inference

Deux options :
- **Fusion** : calculer `W_final = W + α × AB` une fois, puis inferer normalement (zero overhead)
- **Additive** : garder W et AB separes, calculer `output = Wx + α(ABx)` a chaque forward pass (permet de changer de LoRA a chaud)

On utilise la fusion (`pipeline.fuse_lora()`) car c'est plus rapide et on ne change pas de LoRA en cours de generation.

---

## Hyperparametres cles

| Parametre | Valeur typique | Notre config | Effet |
|-----------|---------------|--------------|-------|
| `r` (rang) | 4-64 | **4** | Dimensionnalite de l'adaptation. r=4 pour style simple, r=32+ pour concepts complexes. |
| `alpha` | r × 1-2 | **4** | Facteur d'echelle. `alpha/r` donne le scaling effectif. `alpha=r` → scaling 1.0. |
| `learning_rate` | 1e-5 - 1e-3 | **1e-4** | Vitesse d'apprentissage. Trop haut = instable. Trop bas = pas de convergence. |
| `steps` | 500-5000 | **800** | Nombre d'iterations. Trop = overfitting (copie les images). Pas assez = pas de style. |
| `batch_size` | 1-4 | **1** | Images par iteration. 1 suffit avec gradient accumulation. |
| `grad_accum` | 1-8 | **4** | Simule un batch plus grand. batch_size=1 × grad_accum=4 ≈ batch_size=4 en termes de stabilite. |
| `resolution` | 512 | **512** | Taille des images d'entrainement. Doit correspondre au modele SD (512 pour SD 1.5). |

### Rang : r = 4, pourquoi ?

Le style pixel art Maestro se resume a quelques proprietes visuelles :
- Pixels nets (pas d'antialiasing)
- 2-3 couleurs maximum
- Contours definis
- Esthetique retro / low-res

Ce sont des signaux de basse dimensionnalite. Un rang de 4 suffit pour les capturer. Un rang plus eleve (16, 32) donnerait plus de controle sur les details mais risque l'overfitting avec un dataset de 20-30 images.

---

## Le dataset d'entrainement

### Composition

Le dataset pour le LoRA `maestro-v1` contiendra ~25 images :

| Source | Nombre | Description |
|--------|--------|-------------|
| Nos sprites existants (rendus via bitmap-preview) | 10 | Les 5 etats × 2 frames de la mascotte, rendus a 512×512 |
| References Flipper Zero | 10 | Sprites open-source du Flipper Zero, redimensionnes a 512×512 |
| Variations manuelles | 5 | Sprites modifies pour augmenter la diversite |

### Regles du dataset

1. **Resolution uniforme** : Toutes les images a 512×512 (resolution native de SD 1.5)
2. **Captions precises** : Chaque image a un fichier `.txt` avec une description precise
3. **Style coherent** : Toutes les images doivent partager le meme style cible
4. **Fond uniforme** : Fond blanc ou transparent, pas de fond complexe
5. **Centre** : Le sujet doit etre centre dans l'image

### Format des captions

Chaque image `xxx.png` est accompagnee de `xxx.txt` :

```
pixel art robot character, dome head, antenna, rectangular visor eyes,
chest panel with indicator, articulated arms, chunky pixels, 2-color
monochrome, retro handheld sprite, crisp edges, no antialiasing,
centered on white background
```

Le prefix `pixel art` et les tags de style (`chunky pixels`, `crisp edges`, `no antialiasing`) doivent etre dans CHAQUE caption pour que le LoRA associe ces concepts a notre style.

### Trigger word

Le LoRA sera associe a un **mot declencheur** : `maestro_pixelart`. Ce mot n'existe pas dans le vocabulaire de SD, donc il n'aura aucun sens par defaut. Apres l'entrainement, il activera specifiquement notre style.

```
Prompt: "maestro_pixelart robot face with round glasses"
→ Active le style LoRA + genere le contenu demande
```

---

## Risques et mitigations

### Overfitting

**Symptome** : Le modele reproduit exactement les images d'entrainement au lieu de generaliser le style.

**Detection** : Generer 10 images avec des prompts varies. Si elles ressemblent toutes a la meme image du dataset → overfitting.

**Mitigation** :
- Reduire le nombre de steps (800 → 500)
- Reduire le learning rate
- Augmenter la diversite du dataset
- Utiliser un rang plus bas (r=4 au lieu de r=8)

### Underfitting

**Symptome** : Le LoRA n'a aucun effet visible — les generations ressemblent au SD standard.

**Detection** : Comparer une generation avec LoRA vs sans LoRA. Si identiques → underfitting.

**Mitigation** :
- Augmenter le nombre de steps
- Augmenter alpha (scaling plus fort)
- Verifier que les captions sont correctes
- Augmenter le rang (r=4 → r=8)

### Mode collapse

**Symptome** : Toutes les generations sont identiques peu importe le prompt.

**Mitigation** :
- Diversifier les captions (pas juste "pixel art robot" pour toutes les images)
- Reduire cfg_scale pendant la generation
- Utiliser un LoRA weight plus faible (0.6 au lieu de 0.8)

---

## Pipeline d'entrainement dans Maestro

### Architecture

```
llm-provider/
  api/
    models/
      pixel-art-lora/
        dataset/               ← Images + captions d'entrainement
          img_001.png + img_001.txt
          img_002.png + img_002.txt
          ...
        train_lora.py          ← Script d'entrainement
        training-config.json   ← Hyperparametres (reproductibilite)
        maestro-v1.safetensors ← Output : fichier LoRA (~4-8MB)
```

### Workflow

```
1. Preparer le dataset (images 512×512 + captions)
2. Configurer les hyperparametres (training-config.json)
3. Lancer l'entrainement (python train_lora.py)
4. Evaluer : generer 10 images, verifier le style
5. Si bon → sauvegarder comme maestro-v1.safetensors
6. Si mauvais → ajuster hyperparametres, re-entrainer
```

### Integration avec ImageManager

Une fois le LoRA entraine, il est charge par `ImageManager.load_lora()` :

```python
# Au runtime, quand un agent demande une generation :
img_manager.load_lora("maestro-v1")  # Charge le .safetensors
img_manager.generate(
    prompt="maestro_pixelart conductor face, round glasses",
    cfg_scale=12.0,
    seed=42
)
# → Image dans le style Maestro pixel art
```

Le LoRA est charge une seule fois et reste en memoire. Les generations suivantes sont instantanees (pas de rechargement).

---

## Comparaison avec d'autres techniques

### Textual Inversion (TI)

Apprend un **nouveau token** (mot) qui encode le concept/style. Tres leger (~4KB) mais limiteeen expressivite — ne peut capturer que ce qu'un seul embedding peut representer.

| | LoRA | Textual Inversion |
|---|------|-------------------|
| Parametres entraines | ~40K (matrices A, B) | ~1K (embedding token) |
| Expressivite | Style complet | Concept simple |
| Temps entrainement | 30-60 min | 1-3h |
| Fichier output | 4-8 MB | 4 KB |
| Combinable | Oui (multi-LoRA) | Oui (multi-TI) |

### DreamBooth

Full fine-tune d'un sous-ensemble de couches. Plus expressif que LoRA mais beaucoup plus lourd.

| | LoRA | DreamBooth |
|---|------|------------|
| Parametres | ~40K | ~860M (copie du modele) |
| VRAM | 6GB | 16-24GB |
| Fichier output | 4-8 MB | 4 GB |
| Qualite | Bonne pour styles | Meilleure pour visages/objets |

### Pourquoi LoRA pour Maestro

1. **Notre GPU (RTX A1000 6GB)** ne peut pas faire DreamBooth (besoin 16GB+)
2. **Notre besoin est un style**, pas un objet/visage specifique → LoRA suffit
3. **Petits fichiers** = facile a versionner, distribuer, et switcher entre styles
4. **Combinable** = on pourrait fusionner `maestro-v1` (style) + `pixel-characters-v1` (personnages)

---

## References

- [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — Paper original (Hu et al., 2021)
- [HuggingFace Diffusers LoRA Training](https://huggingface.co/docs/diffusers/training/lora) — Guide officiel
- [Kohya-ss/sd-scripts](https://github.com/kohya-ss/sd-scripts) — Outils populaires pour LoRA training
- [civitai.com](https://civitai.com) — Communaute de LoRA, exemples, bonnes pratiques
