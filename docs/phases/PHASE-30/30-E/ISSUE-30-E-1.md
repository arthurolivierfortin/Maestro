# Issue 30-E-1 : Creer et configurer la session projet E2E

**Statut** : A faire
**Estimation** : 15 minutes
**Prerequis** : 30-D-4 (blocs publies), 30-A-4 (template)

---

## Tache

```bash
cd maestro-cli

node index.js session create --type project --name "Cantante - Autonomous Dev E2E" --template project-autonomous --repo "C:\Cantante" --start

# Ajouter au workspace
node index.js workspace add-session <ws-id> <session-id>

# Lancer le moniteur
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"
```

---

## Critere de completion

- [ ] Session creee avec le template `project-autonomous`
- [ ] Session ajoutee au workspace Phase 30
- [ ] Moniteur en cours d'execution
- [ ] Entry point `dev` disponible
