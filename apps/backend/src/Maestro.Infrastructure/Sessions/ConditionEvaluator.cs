using System.Globalization;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Evaluates boolean condition expressions after resolving template variables.
/// Supports: &amp;&amp;, ||, &lt;, &gt;, &lt;=, &gt;=, ==, !=
///
/// ARCHITECTURE (Phase 53-B): Extracted from NodeExecutionEngine — pure static utility.
/// </summary>
public static class ConditionEvaluator
{
    /// <summary>
    /// Evaluates a boolean condition expression after resolving template variables.
    /// Example: "{{score}} &lt; 0.85 &amp;&amp; {{iteration}} &lt; 50" → true/false
    /// </summary>
    public static bool EvaluateCondition(string conditionTemplate, Domain.Entities.ProjectSession session)
    {
        var resolved = TemplateResolver.ResolveTemplate(conditionTemplate, session);

        // Split on && (all parts must be true)
        var andParts = resolved.Split(new[] { "&&" }, StringSplitOptions.TrimEntries);

        foreach (var andPart in andParts)
        {
            // Each andPart may contain || (any sub-part must be true)
            var orParts = andPart.Split(new[] { "||" }, StringSplitOptions.TrimEntries);
            var anyTrue = false;

            foreach (var orPart in orParts)
            {
                if (EvaluateSimpleComparison(orPart.Trim()))
                {
                    anyTrue = true;
                    break;
                }
            }

            if (!anyTrue) return false;
        }

        return true;
    }

    /// <summary>
    /// Evaluates a single comparison expression (e.g., "0.25 &lt; 0.85").
    /// Tries numeric comparison first, falls back to string comparison.
    /// </summary>
    public static bool EvaluateSimpleComparison(string expr)
    {
        // Try operators in specificity order: <=, >=, !=, ==, <, >
        string[] operators = { "<=", ">=", "!=", "==", "<", ">" };

        foreach (var op in operators)
        {
            var idx = expr.IndexOf(op, StringComparison.Ordinal);
            if (idx >= 0)
            {
                var left = expr[..idx].Trim();
                var right = expr[(idx + op.Length)..].Trim();

                // Strip surrounding quotes from both sides.
                // Conditions like {{var}} != "" resolve to ' != ""' after template substitution.
                // Without unquoting, the comparison becomes "" != "\"\"" → true (wrong).
                left = StripSurroundingQuotes(left);
                right = StripSurroundingQuotes(right);

                // Numeric comparison
                if (double.TryParse(left, CultureInfo.InvariantCulture, out var leftNum) &&
                    double.TryParse(right, CultureInfo.InvariantCulture, out var rightNum))
                {
                    return op switch
                    {
                        "<" => leftNum < rightNum,
                        ">" => leftNum > rightNum,
                        "<=" => leftNum <= rightNum,
                        ">=" => leftNum >= rightNum,
                        "==" => Math.Abs(leftNum - rightNum) < 0.0001,
                        "!=" => Math.Abs(leftNum - rightNum) >= 0.0001,
                        _ => false
                    };
                }

                // String comparison
                return op switch
                {
                    "==" => left == right,
                    "!=" => left != right,
                    _ => false
                };
            }
        }

        // Boolean literal
        if (bool.TryParse(expr, out var boolVal)) return boolVal;

        // Truthy: non-empty, non-zero
        if (double.TryParse(expr, CultureInfo.InvariantCulture, out var numVal)) return numVal != 0;
        return !string.IsNullOrEmpty(expr) && expr != "0" && expr.ToLowerInvariant() != "false";
    }

    /// <summary>
    /// Strips surrounding double quotes from a string literal.
    /// Handles conditions like {{var}} != "" where after template resolution
    /// the empty string value is compared against the literal "".
    /// </summary>
    public static string StripSurroundingQuotes(string s)
    {
        if (s.Length >= 2 && s[0] == '"' && s[^1] == '"')
            return s[1..^1];
        return s;
    }
}
