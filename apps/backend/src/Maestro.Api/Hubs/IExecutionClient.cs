namespace Maestro.Api.Hubs;

public interface IExecutionClient
{
    Task ExecutionStarted(string executionId);
    Task BlockStarted(string executionId, string blockId);
    Task BlockCompleted(string executionId, string blockId);
    Task BlockFailed(string executionId, string blockId, string error);
    Task ExecutionCompleted(string executionId);
    Task ExecutionFailed(string executionId, string error);
    Task LogAdded(string executionId, string logLine);
}
