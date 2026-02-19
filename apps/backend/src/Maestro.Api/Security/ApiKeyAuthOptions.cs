namespace Maestro.Api.Security;

public class ApiKeyAuthOptions
{
    public const string SectionName = "Security";

    public bool Enabled { get; set; } = true;
    public bool AllowRemote { get; set; } = false;
}
