# Generated Contracts

Ce dossier contient des contrats `*.contract.json` produits par les workflows block-forge (`contract-definer`, `block-creator`, etc.) lors des phases de test et de dogfooding.

## Différence avec `content/system/contracts/`

- **`content/system/contracts/`** : contrats **canoniques** — édités manuellement, livrés avec Maestro, font partie du SDK.
- **`content/_generated/contracts/`** : contrats **générés** — produits par exécution de workflows, conservés comme preuve que le pipeline fonctionne et comme catalogue d'exemples.

## Ne PAS utiliser ces contrats en production

Ces contrats peuvent être incomplets, redondants (ex: `doc-generator` vs `doc-generator-agent` vs `documentation-creator`), ou refléter d'anciens schémas. Avant d'utiliser un de ces contrats, le promouvoir vers `content/system/contracts/` après revue manuelle.

## Origine

Première vague (mars 2026) : Phase 64 dogfooding du workflow `contract-definer`. Les 18 contrats correspondent aux 18 essais d'agents générés pendant les tests itératifs du pipeline block-forge.
