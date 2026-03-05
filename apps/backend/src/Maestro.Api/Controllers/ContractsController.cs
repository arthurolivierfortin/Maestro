using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers
{
    /// <summary>
    /// API controller for contract definitions.
    /// Contracts define roles that blocks can implement (e.g. "maestro-assistant").
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ContractsController : ControllerBase
    {
        private readonly string _contractsPath;

        public ContractsController(IConfiguration configuration)
        {
            var contentRoot = configuration["Maestro:ContentRoot"] ?? Path.Combine(Directory.GetCurrentDirectory(), "content");
            _contractsPath = Path.Combine(contentRoot, "system", "contracts");
        }

        /// <summary>
        /// List all contract definitions.
        /// </summary>
        [HttpGet]
        public ActionResult<List<object>> GetAll()
        {
            if (!Directory.Exists(_contractsPath))
                return Ok(new List<object>());

            var contracts = new List<object>();
            foreach (var file in Directory.EnumerateFiles(_contractsPath, "*.contract.json"))
            {
                try
                {
                    var json = System.IO.File.ReadAllText(file);
                    var doc = JsonSerializer.Deserialize<JsonElement>(json);
                    contracts.Add(doc);
                }
                catch { }
            }

            return Ok(contracts);
        }

        /// <summary>
        /// Get a single contract definition by ID.
        /// </summary>
        [HttpGet("{id}")]
        public ActionResult<object> GetById(string id)
        {
            if (!Directory.Exists(_contractsPath))
                return NotFound(new { error = $"Contract '{id}' not found" });

            var file = Path.Combine(_contractsPath, $"{id}.contract.json");
            if (!System.IO.File.Exists(file))
                return NotFound(new { error = $"Contract '{id}' not found" });

            var json = System.IO.File.ReadAllText(file);
            var doc = JsonSerializer.Deserialize<JsonElement>(json);
            return Ok(doc);
        }
    }
}
