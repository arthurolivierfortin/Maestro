# Plan d'Implémentation: Architecture de Sessions Composables

**Date**: 2026-02-02
**Réf**: ADR-0005

---

## Inventaire du Code Existant à Réutiliser

### Entités et Value Objects (Réutiliser tel quel)

| Fichier | Réutilisation |
|---------|---------------|
| `Domain/ValueObjects/SessionId.cs` | ✅ Réutiliser tel quel |
| `Domain/ValueObjects/Authority.cs` | ✅ Réutiliser tel quel |
| `Domain/ValueObjects/SessionCommand.cs` | ✅ Réutiliser tel quel |
| `Domain/ValueObjects/SessionEvent.cs` | ✅ Réutiliser tel quel |
| `Domain/Entities/SessionBlockRegistry.cs` | ✅ Réutiliser tel quel |
| `Domain/Enums/SessionEnums.cs` | ✅ Réutiliser (SessionStatus, AuthorityType, SessionEventType, etc.) |

### Configuration (Réutiliser partiellement)

| Fichier | Réutilisation |
|---------|---------------|
| `Domain/Configuration/AccessConfig.cs` | ✅ Réutiliser tel quel |
| `Domain/Configuration/ValidationConfig.cs` | ✅ Réutiliser tel quel |
| `Domain/ValueObjects/ResourceLimits.cs` | ✅ Réutiliser tel quel |
| `Domain/Configuration/TrainingRunConfig.cs` | ✅ Intégrer dans SessionConfig |
| `Domain/Configuration/EvaluationConfig.cs` | ✅ Intégrer dans SessionConfig |

### Infrastructure Docker (Réutiliser tel quel)

| Fichier | Réutilisation |
|---------|---------------|
| `Infrastructure/Containers/DockerContainerRuntime.cs` | ✅ Réutiliser tel quel |
| `Infrastructure/Containers/ContainerRuntimeFactory.cs` | 🔄 Modifier (forcer Docker) |
| `Domain/ValueObjects/RuntimeConfiguration.cs` | ✅ Réutiliser tel quel |
| `Domain/ValueObjects/ContainerState.cs` | ✅ Réutiliser tel quel |

### Services (Réutiliser partiellement)

| Fichier | Réutilisation |
|---------|---------------|
| `Infrastructure/Services/ProjectContainerService.cs` | 🔄 Adapter pour Session unifié |
| `Application/Interfaces/IContainerRuntime.cs` | ✅ Réutiliser tel quel |

---

## Étapes d'Implémentation

### Phase 1: Nouveaux Enums et Configuration
**Fichiers à créer:**
- [ ] `Domain/Enums/EnvironmentMode.cs`
- [ ] `Domain/Enums/SessionPurpose.cs`
- [ ] `Domain/Enums/ImageSource.cs`
- [ ] `Domain/Enums/TemplateSource.cs`
- [ ] `Domain/Configuration/SessionConfig.cs` (nouveau, composable)
- [ ] `Domain/Configuration/RepoBind.cs`

### Phase 2: Nouvelles Entités
**Fichiers à créer:**
- [ ] `Domain/Entities/SandboxImage.cs`
- [ ] `Domain/Entities/SessionTemplate.cs`
- [ ] `Domain/Entities/Session.cs` (unifié, remplace les 3 types)

### Phase 3: DTOs
**Fichiers à créer:**
- [ ] `Application/DTOs/SandboxImageDto.cs`
- [ ] `Application/DTOs/SessionTemplateDto.cs`
- [ ] `Application/DTOs/SessionDto.cs` (unifié)
- [ ] `Application/DTOs/SessionConfigDto.cs`

### Phase 4: Interfaces Repository
**Fichiers à créer:**
- [ ] `Application/Interfaces/ISandboxImageRepository.cs`
- [ ] `Application/Interfaces/ISessionTemplateRepository.cs`
- [ ] `Application/Interfaces/ISessionRepository.cs` (unifié)

### Phase 5: Implémentation Repository
**Fichiers à créer:**
- [ ] `Infrastructure/SandboxImages/FileSystemSandboxImageRepository.cs`
- [ ] `Infrastructure/SessionTemplates/FileSystemSessionTemplateRepository.cs`
- [ ] `Infrastructure/Sessions/FileSystemSessionRepository.cs`

### Phase 6: Données Built-in
**Fichiers à créer:**
- [ ] `Infrastructure/Data/BuiltInSandboxImages.cs`
- [ ] `Infrastructure/Data/BuiltInSessionTemplates.cs`

### Phase 7: Services
**Fichiers à créer:**
- [ ] `Application/Interfaces/ISandboxImageService.cs`
- [ ] `Application/Interfaces/ISessionTemplateService.cs`
- [ ] `Application/Interfaces/IUnifiedSessionService.cs`
- [ ] `Infrastructure/Services/SandboxImageService.cs`
- [ ] `Infrastructure/Services/SessionTemplateService.cs`
- [ ] `Infrastructure/Services/UnifiedSessionService.cs`

### Phase 8: Contrôleurs API
**Fichiers à créer:**
- [ ] `Api/Controllers/SandboxImagesController.cs`
- [ ] `Api/Controllers/SessionTemplatesController.cs`

**Fichiers à modifier:**
- [ ] `Api/Controllers/SessionsController.cs` (ajouter nouvelles routes)

### Phase 9: Dockerfiles des Sandbox Images
**Fichiers à créer:**
- [ ] `docker/sandbox-images/sandbox-empty/Dockerfile`
- [ ] `docker/sandbox-images/sandbox-git/Dockerfile`
- [ ] `docker/sandbox-images/sandbox-nodejs/Dockerfile`
- [ ] `docker/sandbox-images/sandbox-python/Dockerfile`
- [ ] `docker/sandbox-images/build-all.ps1`

### Phase 10: Enregistrement DI
**Fichier à modifier:**
- [ ] `Api/Program.cs`

### Phase 11: Frontend (Types et Services)
**Fichiers à créer:**
- [ ] `frontend/src/types/session.types.ts` (nouveau)
- [ ] `frontend/src/types/sandboxImage.types.ts`
- [ ] `frontend/src/types/sessionTemplate.types.ts`
- [ ] `frontend/src/services/sandboxImageService.ts`
- [ ] `frontend/src/services/sessionTemplateService.ts`

**Fichiers à modifier:**
- [ ] `frontend/src/services/sessionService.ts` (adapter)

### Phase 12: Frontend (Store)
**Fichiers à créer:**
- [ ] `frontend/src/store/sandboxImageStore.ts`
- [ ] `frontend/src/store/sessionTemplateStore.ts`

**Fichiers à modifier:**
- [ ] `frontend/src/store/sessionStore.ts` (adapter)

### Phase 13: Frontend (Composants UI)
**Fichiers à créer:**
- [ ] `frontend/src/components/Sessions/CreateSessionDialog.tsx`
- [ ] `frontend/src/components/Sessions/TemplateSelector.tsx`
- [ ] `frontend/src/components/Sessions/EnvironmentModeToggle.tsx`
- [ ] `frontend/src/components/Sessions/SandboxImagePicker.tsx`
- [ ] `frontend/src/components/SandboxImages/SandboxImageList.tsx`
- [ ] `frontend/src/components/SandboxImages/RegisterImageDialog.tsx`

---

## Ordre d'Exécution

```
Phase 1-2: Domain (Enums, Config, Entités)
    │
    ▼
Phase 3-4: Application (DTOs, Interfaces)
    │
    ▼
Phase 5-6: Infrastructure (Repositories, Built-in Data)
    │
    ▼
Phase 7: Services
    │
    ▼
Phase 8: API Controllers
    │
    ▼
Phase 9: Dockerfiles
    │
    ▼
Phase 10: DI Registration
    │
    ▼
Phase 11-13: Frontend
```

---

## Validation à Chaque Phase

### Après Phase 2
- [ ] Compiler le backend sans erreurs
- [ ] Les nouvelles entités sont créées

### Après Phase 5
- [ ] Les repositories peuvent sauvegarder/charger des données

### Après Phase 8
- [ ] Les endpoints API répondent (test avec curl/Postman)

### Après Phase 10
- [ ] `dotnet run` démarre sans erreurs
- [ ] `/api/sandbox-images` retourne les images built-in
- [ ] `/api/session-templates` retourne les templates built-in

### Après Phase 13
- [ ] L'UI affiche les sandbox images
- [ ] L'UI permet de créer une session depuis un template
