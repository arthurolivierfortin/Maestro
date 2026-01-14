using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class BlocksControllerIntegrationTests : IClassFixture<WebApplicationFactory<Maestro.Api.Program>>
    {
        private readonly WebApplicationFactory<Maestro.Api.Program> _factory;

        public BlocksControllerIntegrationTests(WebApplicationFactory<Maestro.Api.Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task GetAll_ReturnsOk()
        {
            var client = _factory.CreateClient();
            var res = await client.GetAsync("/api/blocks");
            res.EnsureSuccessStatusCode();
        }

        [Fact]
        public async Task CreateUpdateDelete_BlockLifecycle()
        {
            var client = _factory.CreateClient();

            var sample = new
            {
                id = "int-test-block",
                name = "Integration Test Block",
                blockType = "prompt",
                version = "1.0"
            };

            // Create
            var createRes = await client.PostAsJsonAsync("/api/blocks", sample);
            createRes.EnsureSuccessStatusCode();

            var created = await createRes.Content.ReadFromJsonAsync<dynamic>();

            // Get
            var getRes = await client.GetAsync($"/api/blocks/{sample.id}");
            getRes.EnsureSuccessStatusCode();

            // Update
            var update = new { name = "Updated Name" };
            var putRes = await client.PutAsJsonAsync($"/api/blocks/{sample.id}", update);
            putRes.EnsureSuccessStatusCode();

            // Delete
            var delRes = await client.DeleteAsync($"/api/blocks/{sample.id}");
            Assert.True(delRes.IsSuccessStatusCode || delRes.StatusCode == System.Net.HttpStatusCode.NoContent);
        }
    }
}
