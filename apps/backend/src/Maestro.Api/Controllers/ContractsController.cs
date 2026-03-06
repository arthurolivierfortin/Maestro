using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Maestro.Infrastructure.Configuration;
using Newtonsoft.Json.Linq;

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

        public ContractsController(MaestroPathConfiguration pathConfig)
        {
            _contractsPath = Path.Combine(pathConfig.RepoRootPath, "content", "system", "contracts");
        }

        /// <summary>
        /// List all contract definitions.
        /// </summary>
        [HttpGet]
        public ActionResult<JArray> GetAll()
        {
            if (!Directory.Exists(_contractsPath))
                return Ok(new JArray());

            var contracts = new JArray();
            foreach (var file in Directory.EnumerateFiles(_contractsPath, "*.contract.json"))
            {
                try
                {
                    var json = System.IO.File.ReadAllText(file);
                    var doc = JToken.Parse(json);
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
        public ActionResult<JObject> GetById(string id)
        {
            if (!Directory.Exists(_contractsPath))
                return NotFound(new { error = $"Contract '{id}' not found" });

            var file = Path.Combine(_contractsPath, $"{id}.contract.json");
            if (!System.IO.File.Exists(file))
                return NotFound(new { error = $"Contract '{id}' not found" });

            var json = System.IO.File.ReadAllText(file);
            var doc = JObject.Parse(json);
            return Ok(doc);
        }
    }
}
