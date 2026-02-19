namespace Maestro.Domain.Entities
{
    public class ConnectionDefinition
    {
        public string FromBlockId { get; set; } = string.Empty;
        public string FromPort { get; set; } = "default";
        public string ToBlockId { get; set; } = string.Empty;
        public string ToPort { get; set; } = "default";
    }
}
