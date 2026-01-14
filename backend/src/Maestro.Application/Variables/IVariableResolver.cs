using System.Collections.Generic;

namespace Maestro.Application.Variables;

public interface IVariableResolver
{
    string Resolve(string template, IDictionary<string, object>? variables = null);
}
