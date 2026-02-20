Voici mon analyse honnete des problemes et mes recommandations, du plus impactant au moins impactant.                                                                                                             
  ---                                                                                                                                                             Probleme #1 : File-write casse (BLOQUANT)
                                                                                                                                                                    Cause racine : Le contenu de fichier passe par 4 couches de serialisation texte :                                                                                                                              

  LLM genere JSON string → AgentBlockExecutor parse → CliParser tokenise → RunCommandHandler extrait → file-write ecrit

  Chaque couche casse le contenu : guillemets echappes, newlines, espaces, troncature JSON. C'est un probleme architecturalement fondamental — on fait transiter du code source a travers un parseur de commandes
   CLI concu pour des arguments courts.

  Ma recommandation : Native tools dans AgentBlockExecutor

  Au lieu de router les operations fichier via maestro_cli → CLI parser → block executor, l'AgentBlockExecutor devrait intercepter les tool calls de type I/O et les traiter directement en C# :

  // Dans la boucle agentique, apres le parsing du tool call JSON :
  if (toolCall.Tool == "file-write")
  {
      // args.path et args.content sont deja parses par System.Text.Json
      // → les newlines, quotes, caracteres speciaux sont DEJA corrects
      await File.WriteAllTextAsync(args.Path, args.Content);
      toolResult = $"File written: {args.Path} ({args.Content.Length} chars)";
  }
  else if (toolCall.Tool == "file-read")
  {
      toolResult = await File.ReadAllTextAsync(args.Path);
  }
  else if (toolCall.Tool == "shell-execute")
  {
      toolResult = await RunShellCommand(args.Command);
  }
  else if (toolCall.Tool == "maestro_cli")
  {
      // Route existante — pour les blocs (run block-id --input ...)
      toolResult = await ExecuteCliCommand(args.Command);
  }

  Pourquoi ca marche : Le JSON du tool call est deja parse par System.Text.Json au moment ou on extrait args.content. Les newlines sont de vrais \n, les guillemets sont de vrais ". On n'a plus besoin de       
  re-serialiser/re-parser a travers le CLI.

  Pourquoi ca ne viole pas l'architecture : L'executor reste mecanique. Il ne sait pas QUOI ecrire — il ecrit ce que l'agent demande. C'est du plumbing I/O, pas du contenu. Le system prompt du bloc definit    
  toujours les tools disponibles. On peut meme decrire les native tools dans la config du bloc :

  {
    "config": {
      "nativeTools": ["file-read", "file-write", "directory-list", "shell-execute"],
      "maxIterations": 10
    }
  }

  Effort : ~50 lignes dans AgentBlockExecutor.cs. Aucun autre fichier modifie.

  ---
  Probleme #2 : Agent ne sait pas appeler done

  Cause racine : L'agent essaie step-complete, output, log-result — des noms de blocs qui n'existent pas. Le modele generalise a partir d'autres prompts qu'il a vus pendant son entrainement.

  Trois fixes complementaires :

  Fix A : Fallback intelligent dans l'executor (~10 lignes)

  if (toolCall.Tool == "done") { /* existant */ }
  else if (toolCall.Tool is "step-complete" or "output" or "complete" or "finish" or "log-result")
  {
      // L'agent essaie de terminer mais utilise le mauvais nom
      _logger.LogWarning("Agent called '{Tool}' — treating as 'done'", toolCall.Tool);
      // Traiter comme done
  }

  C'est pragmatique. L'agent VEUT terminer, il utilise juste le mauvais mot.

  Fix B : Exemples negatifs dans le system prompt

  Ajouter dans system-prompt.md :

  ## WRONG tool names — these DO NOT EXIST
  - `step-complete` — DOES NOT EXIST. Use `done`.
  - `output` — DOES NOT EXIST. Use `done`.
  - `complete` — DOES NOT EXIST. Use `done`.
  - `log-result` — DOES NOT EXIST. Use `done`.

  Fix C : Simplifier le format done

  Le format actuel est verbose :
  {"tool":"done","args":{"summary":"{\"stepId\":1,\"action\":\"create\",\"target\":\"...\",\"success\":true,\"notes\":\"...\"}"}}

  Un JSON dans un JSON dans un JSON. Simplifier :
  {"tool":"done","args":{"stepId":1,"success":true,"notes":"Created file"}}

  ---
  Probleme #3 : Trop de couches, trop d'appels LLM

  Constat : Pour ecrire UN fichier, le workflow actuel fait :

  task-planner (agent, ~5 tours LLM)
  → json-validator (tool, 0 LLM)
  → for-each step:
      → implement-single-step (agent, ~5-10 tours LLM)
      → step-validator (inference, 1 LLM)
      → test-executor (agent, ~3-5 tours LLM)
      → code-reviewer (inference, 1 LLM)
      → git-committer (agent, ~3 tours LLM)

  Pour 10 steps : ~100-170 appels LLM. Claude CLI fait la meme chose en 1 appel.

  Recommandation : Mode "direct write" pour les steps simples

  Le plan contient DEJA la description complete du fichier a creer. Pour les actions create, on n'a pas besoin d'un agent avec 10 tours — on a besoin d'un seul appel inference :

  Etape "create src/types.ts" →
    1 appel inference : "Ecris le contenu complet du fichier selon cette description: ..."
    → native tool file-write avec la sortie

  Ca transforme les ~10 tours d'agent en 1 appel. Pour 10 steps : ~15-20 appels LLM au total au lieu de 100+.

  Concretement, creer un bloc direct-implementer de type inference (pas agent) :

  {
    "id": "direct-implementer",
    "type": "inference",
    "config": {
      "model": "claude-sonnet-4-6",
      "systemPrompt": "Given a plan step, output ONLY the complete file content. No explanation.",
      "outputFormat": "raw"
    }
  }

  Puis dans le workflow, apres l'inference, un tool block file-write ecrit le resultat. Pas de boucle agentique.

  Pour modify et add-dependency, garder l'agent (il a besoin de lire le fichier d'abord).

  ---
  Probleme #4 : Cout

  Constat : ~$30+ pour 0 resultat. Claude CLI : ~$2-5 pour 5 features.

  Causes :
  1. Chaque tour agent renvoie l'historique complet (prompt tokens cumulent)
  2. Opus utilise pour le code-reviewer ($15/$75M) — cher
  3. 3 runs E2E = 3x le cout pour du debug

  Recommandations :

  ┌──────────────────────────────────────────┬────────────────────────────┐
  │                  Action                  │      Economie estimee      │
  ├──────────────────────────────────────────┼────────────────────────────┤
  │ Direct-implementer au lieu d'agent       │ ~60% (1 appel vs 5-10)     │
  ├──────────────────────────────────────────┼────────────────────────────┤
  │ Haiku pour step-validator                │ ~90% sur ce bloc           │
  ├──────────────────────────────────────────┼────────────────────────────┤
  │ Sonnet au lieu d'Opus pour code-reviewer │ ~80% sur ce bloc           │
  ├──────────────────────────────────────────┼────────────────────────────┤
  │ Reduire maxIterations de 15 a 6          │ ~40% sur les agents        │
  ├──────────────────────────────────────────┼────────────────────────────┤
  │ Tests isoles avant E2E ($0.20 vs $15+)   │ Deja fait — bonne pratique │
  └──────────────────────────────────────────┴────────────────────────────┘

  Cout estime apres optimisation : ~$1-3 par run E2E (vs ~$10-15 actuellement).

  ---
  Plan d'action propose

  ┌──────────┬──────────────────────────────────┬────────────────────────┬──────────────────┐
  │ Priorite │               Fix                │         Effort         │      Impact      │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P0       │ Native tools (file-write direct) │ ~50 lignes C#          │ Debloque tout    │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P0       │ Done fallback dans executor      │ ~10 lignes C#          │ Agents terminent │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P1       │ System prompt exemples negatifs  │ ~10 lignes MD          │ Reduit fallbacks │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P1       │ Format done simplifie            │ ~5 lignes MD + C#      │ Moins d'erreurs  │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P2       │ Direct-implementer (inference)   │ 1 bloc JSON + workflow │ -60% appels LLM  │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P2       │ Sonnet pour code-reviewer        │ 1 ligne config         │ -80% cout review │
  ├──────────┼──────────────────────────────────┼────────────────────────┼──────────────────┤
  │ P3       │ maxIterations 15→6               │ 1 ligne config         │ -40% cout agents │
  └──────────┴──────────────────────────────────┴────────────────────────┴──────────────────┘

  P0 seul suffit pour Run 4. Si file-write et done fonctionnent, le workflow complet peut tourner. P1-P3 sont des optimisations pour la competitivite cout/vitesse.

  ---
  Mon avis franc : Le P0 (native tools) est la seule chose qui compte maintenant. Tant que l'agent ne peut pas ecrire de fichiers, tout le reste est theorique. C'est ~50 lignes de C# qui debloquent tout le    
  pipeline. Le reste (cout, vitesse, direct-implementer) peut attendre que le workflow fonctionne de bout en bout.