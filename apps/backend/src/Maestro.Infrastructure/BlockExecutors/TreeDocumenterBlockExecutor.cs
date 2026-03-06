using System.Text;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Generates a markdown document describing a session's workflow/block tree.
/// Extracted from NodeExecutionEngine.ExecuteTreeDocumenterAsync — same logic.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class TreeDocumenterBlockExecutor : IBlockExecutor
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly IProjectSessionRepository _repository;

    public string SupportedType => "tree-documenter";

    public TreeDocumenterBlockExecutor(
        IBlockDiscoveryService blockDiscovery,
        IProjectSessionRepository repository)
    {
        _blockDiscovery = blockDiscovery;
        _repository = repository;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var sessionId = context.Variables.TryGetValue("sessionId", out var sidObj) ? sidObj?.ToString() : null;
        if (string.IsNullOrEmpty(sessionId))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing sessionId in context";
            return result;
        }

        var session = await _repository.GetByIdAsync(SessionId.From(sessionId));
        if (session == null)
        {
            result.Success = false;
            result.Outputs["error"] = $"Session not found: {sessionId}";
            return result;
        }

        var maxDepth = 10;
        if (inputs.TryGetValue("maxDepth", out var mdObj))
        {
            if (mdObj is int mdi) maxDepth = mdi;
            else if (mdObj is long mdl) maxDepth = (int)mdl;
            else int.TryParse(mdObj?.ToString(), out maxDepth);
        }

        var sb = new StringBuilder();
        var documentedBlocks = new HashSet<string>();

        sb.AppendLine("```");
        sb.AppendLine("┌─ SESSION ────────────────────────────────────────────────────────┐");
        var shortId = session.Id.Length >= 8 ? session.Id[..8] : session.Id;
        sb.AppendLine($"│  {session.Name,-50} {shortId}  {session.Status,-8} │");
        if (!string.IsNullOrEmpty(session.RepositoryPath))
            sb.AppendLine($"│  repo: {session.RepositoryPath,-60} │");

        if (session.EntryPoints.Count > 0)
        {
            sb.AppendLine("│  Entry Points:                                                              │");
            foreach (var ep in session.EntryPoints)
                sb.AppendLine($"│    {ep.Key,-16} → {ep.Value,-52} │");
        }

        sb.AppendLine("├─ BLOCK TREE ─────────────────────────────────────────────────────┤");

        var entryBlockIds = session.EntryPoints.Values.Distinct().ToList();
        foreach (var rawId in entryBlockIds)
        {
            var normalizedId = Sessions.NodeExecutionEngine.NormalizeBlockId(rawId);
            var entryBlock = await _blockDiscovery.GetByIdAsync(normalizedId, session.BlockSearchPaths);
            if (entryBlock == null)
            {
                sb.AppendLine($"│  ✗ {rawId,-64} [not found] │");
                continue;
            }

            var typeSymbol = entryBlock.BlockType switch
            {
                "workflow" => "▼",
                "agent" => "◆",
                "task" => "▶",
                _ => "○"
            };
            sb.AppendLine($"│  {typeSymbol} {entryBlock.Name,-56} [{entryBlock.BlockType}] │");
            sb.AppendLine($"│    {entryBlock.Id}  v{entryBlock.Version}");
            sb.AppendLine("│");

            documentedBlocks.Add(entryBlock.Id);
        }

        sb.AppendLine("└──────────────────────────────────────────────────────────────────┘");
        sb.AppendLine("```");

        var tree = sb.ToString();
        result.Outputs["tree"] = tree;
        result.Logs.Add($"Generated tree documentation ({tree.Length} chars, {documentedBlocks.Count} blocks)");

        // Write to file if path specified
        if (inputs.TryGetValue("path", out var pathObj) && !string.IsNullOrEmpty(pathObj?.ToString()))
        {
            var outputPath = pathObj.ToString()!;
            var dir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(outputPath, tree, ct);
            result.Logs.Add($"Written to {outputPath}");
        }

        return result;
    }
}
