using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BlocksController : ControllerBase
    {
        private readonly IBlockDiscoveryService _discovery;
        private readonly IBlockRepository _repository;

        public BlocksController(IBlockDiscoveryService discovery, IBlockRepository repository)
        {
            _discovery = discovery;
            _repository = repository;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var blocks = await _discovery.DiscoverAllAsync();
            return Ok(blocks);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null) return NotFound();
            return Ok(block);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] object body)
        {
            // Minimal: accept block JSON and save
            // In a complete impl, map to BlockDefinition and validate
            return BadRequest("Not implemented");
        }
    }
}
