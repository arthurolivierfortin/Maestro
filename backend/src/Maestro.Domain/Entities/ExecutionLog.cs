using System;

namespace Maestro.Domain.Entities
{
    public class ExecutionLog
    {
        public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
        public string Level { get; init; } = "Info";
        public string Message { get; init; } = string.Empty;
        public string? BlockId { get; init; }
    }
}
