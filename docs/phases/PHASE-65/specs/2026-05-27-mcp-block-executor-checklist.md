# Checklist — McpBlockExecutor

**Linked spec:** [2026-05-27-mcp-block-executor-design.md](2026-05-27-mcp-block-executor-design.md)
**Tags:** [sdk]
**Phase:** Phase-65

## Code
- [x] [SPEC-1] [sdk] Ajouter `ModelContextProtocol` NuGet (v1.3.0+) a `Maestro.Infrastructure.csproj` — `apps/backend/src/Maestro.Infrastructure/Maestro.Infrastructure.csproj`
- [x] [SPEC-2] [sdk] Creer `IMcpClientFactory` interface avec methode pour obtenir un client MCP par config (command, args) et `IAsyncDisposable` — `apps/backend/src/Maestro.Infrastructure/Mcp/IMcpClientFactory.cs`
- [x] [SPEC-3] [sdk] Creer `McpClientFactory` implementation : demarrage processus MCP stdio via le NuGet, cache par cle (command+args-hash), dispose kill les processus — `apps/backend/src/Maestro.Infrastructure/Mcp/McpClientFactory.cs`
- [x] [SPEC-4] [sdk] Creer `McpBlockExecutor` avec `SupportedType = "mcp-server"`, operation `list-tools` qui retourne les tools du server dans `Outputs["tools"]` — `apps/backend/src/Maestro.Infrastructure/BlockExecutors/McpBlockExecutor.cs`
- [x] [SPEC-5] [sdk] Ajouter operation `call-tool` dans `McpBlockExecutor` qui lit `inputs["toolName"]` + `inputs["arguments"]`, appelle le MCP server, retourne le resultat dans `Outputs["result"]` — `apps/backend/src/Maestro.Infrastructure/BlockExecutors/McpBlockExecutor.cs`
- [x] [SPEC-6] [sdk] Gestion des erreurs dans `McpBlockExecutor` : operation inconnue → `Success=false` + log, exception MCP → `Success=false` + `Outputs["error"]` + log, pas de catch silencieux — `apps/backend/src/Maestro.Infrastructure/BlockExecutors/McpBlockExecutor.cs`
- [ ] [SPEC-7] [sdk] Enregistrer `IMcpClientFactory` (singleton) et `McpBlockExecutor` (scoped `IBlockExecutor`) dans le DI — `apps/backend/src/Maestro.Api/Program.cs`
- [ ] [SPEC-8] [sdk] Creer sample block.json pour MCP filesystem server avec `blockType: "mcp-server"`, config command/args/transport — `content/system/blocks/tools/mcp-filesystem/mcp-filesystem.tool.block.json`

## Tests
- [x] [TEST-1] `McpBlockExecutor.ExecuteAsync` avec operation `list-tools` route vers le client MCP et retourne les tools dans Outputs — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/McpBlockExecutorTests.cs::ListTools_ReturnsToolsFromMcpClient`
- [x] [TEST-2] `McpBlockExecutor.ExecuteAsync` avec operation `call-tool` route vers le client MCP avec toolName+arguments et retourne le resultat — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/McpBlockExecutorTests.cs::CallTool_RoutesToMcpClientWithCorrectArgs`
- [x] [TEST-3] `McpBlockExecutor.ExecuteAsync` avec operation inconnue retourne `Success=false` avec log — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/McpBlockExecutorTests.cs::UnknownOperation_ReturnsFalse`
- [x] [TEST-4] `McpBlockExecutor.ExecuteAsync` propage les exceptions MCP avec `Success=false` et `Outputs["error"]` — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/McpBlockExecutorTests.cs::McpException_PropagatesAsFailure`
- [x] [TEST-5] `McpBlockExecutor.SupportedType` retourne `"mcp-server"` — `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/McpBlockExecutorTests.cs::SupportedType_IsMcpServer`
- [x] [TEST-6] `McpClientFactory.GetOrCreateClientAsync` retourne le meme client pour la meme config (cache hit) — `apps/backend/tests/Maestro.Infrastructure.Tests/Mcp/McpClientFactoryTests.cs::SameConfig_ReturnsCachedClient`
- [x] [TEST-7] `McpClientFactory.GetOrCreateClientAsync` retourne des clients differents pour des configs differentes — `apps/backend/tests/Maestro.Infrastructure.Tests/Mcp/McpClientFactoryTests.cs::DifferentConfig_ReturnsDifferentClients`
- [x] [TEST-8] `McpClientFactory.DisposeAsync` dispose tous les clients caches — `apps/backend/tests/Maestro.Infrastructure.Tests/Mcp/McpClientFactoryTests.cs::DisposeAsync_DisposesAllClients`

## Database / Migrations
- [ ] [DB-0] None

## Block / Contract changes
- [ ] [BLOCK-1] Sample block `mcp-filesystem.tool.block.json` avec `blockType: "mcp-server"`, config `command: "npx"`, `args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"]`, `transport: "stdio"` — `content/system/blocks/tools/mcp-filesystem/mcp-filesystem.tool.block.json`
- [ ] [CONTRACT-0] None (pas de contrat MCP pour V1 — le McpBlockExecutor est un executor generique, pas un contrat)

## Verification gates (6 layers TESTING-PROTOCOL)
- [ ] [GATE-1] Layer 1 Type Check : `dotnet build apps/backend/Maestro.sln`
- [ ] [GATE-2] Layer 2 Unit Tests : `dotnet test apps/backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj --filter "FullyQualifiedName~McpBlockExecutor|FullyQualifiedName~McpClientFactory"`
- [ ] [GATE-3] Layer 4 Real Demo Check : N/A (pas de TUI touchee)
- [ ] [GATE-4] Layer 5 Integration : N/A (pas d'integration test requise — le MCP client est mocke, l'integration reelle avec un vrai MCP server est hors scope V1 sauf si le researcher determine que c'est faisable)
- [ ] [GATE-5] Provider verification : N/A (pas de workflow/agent touche)
