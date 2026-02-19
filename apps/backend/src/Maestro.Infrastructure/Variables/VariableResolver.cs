using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Maestro.Application.Variables;

namespace Maestro.Infrastructure.Variables;

public class VariableResolver : IVariableResolver
{
    private static readonly Regex TokenRegex = new Regex(@"\$\{(variables|env)\.([^}]+)\}", RegexOptions.Compiled);

    public string Resolve(string template, IDictionary<string, object>? variables = null)
    {
        if (string.IsNullOrEmpty(template)) return template;

        string result = template;
        var maxDepth = 5;
        for (int depth = 0; depth < maxDepth; depth++)
        {
            var replaced = TokenRegex.Replace(result, match =>
            {
                var scope = match.Groups[1].Value;
                var key = match.Groups[2].Value;
                if (scope == "variables" && variables != null && variables.TryGetValue(key, out var v))
                    return v?.ToString() ?? string.Empty;
                if (scope == "env")
                    return Environment.GetEnvironmentVariable(key) ?? string.Empty;
                return string.Empty;
            });

            if (replaced == result) break;
            result = replaced;
        }

        return result;
    }
}
