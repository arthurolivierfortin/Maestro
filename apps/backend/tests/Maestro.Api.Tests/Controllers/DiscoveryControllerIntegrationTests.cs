using Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Text.Json;
using Maestro.Application.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Maestro.Api.Tests.Controllers
{
    public class DiscoveryControllerIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly HttpClient _client;

        public DiscoveryControllerIntegrationTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task GetHealth_ShouldReturn200WithHealthResponse()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/health");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var health = JsonSerializer.Deserialize<HealthResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(health);
            Assert.Equal("healthy", health.Status);
            Assert.NotNull(health.Version);
            Assert.True(health.BlockCount >= 0);
            Assert.NotEmpty(health.Services);
        }

        [Fact]
        public async Task GetCapabilities_ShouldReturn200WithCapabilitiesResponse()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/capabilities");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var capabilities = JsonSerializer.Deserialize<CapabilitiesResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(capabilities);
            Assert.NotEmpty(capabilities.BlockTypes);
            Assert.NotEmpty(capabilities.Executors);
            Assert.NotEmpty(capabilities.LLMProviders);
            Assert.NotEmpty(capabilities.Features);
        }

        [Fact]
        public async Task GetConfig_ShouldReturn200WithConfigResponse()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/config");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var config = JsonSerializer.Deserialize<ConfigResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(config);
            Assert.NotEmpty(config.BlockSearchPaths);
            Assert.NotNull(config.DefaultLLMProvider);
            Assert.True(config.ExecutionTimeout > TimeSpan.Zero);
            Assert.True(config.MaxConcurrentExecutions > 0);
            Assert.True(config.SignalREnabled);
        }

        [Fact]
        public async Task GetBlockTypes_ShouldReturn200WithBlockTypesList()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks/types");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var blockTypes = JsonSerializer.Deserialize<List<BlockTypeInfo>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(blockTypes);
            Assert.NotEmpty(blockTypes);
            
            // Check that at least some expected block types exist
            var types = new HashSet<string>(blockTypes.Select(bt => bt.Type));
            Assert.True(types.Count > 0);
        }

        [Fact]
        public async Task GetBlocks_WithoutFilters_ShouldReturn200WithBlockList()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var blocks = JsonSerializer.Deserialize<List<BlockDto>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(blocks);
            // Blocks list may be empty if no blocks exist, that's okay
        }

        [Fact]
        public async Task GetBlocks_WithTypeFilter_ShouldReturnFilteredBlocks()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks?type=Agent");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var blocks = JsonSerializer.Deserialize<List<BlockDto>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(blocks);
            // If there are blocks, they should all be of type Agent
            if (blocks.Count > 0)
            {
                Assert.All(blocks, b => Assert.Equal("Agent", b.BlockType));
            }
        }

        [Fact]
        public async Task SearchBlocks_WithoutQuery_ShouldReturn400()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks/search");

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task SearchBlocks_WithValidQuery_ShouldReturn200()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks/search?q=test");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var results = JsonSerializer.Deserialize<List<BlockDto>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(results);
        }

        [Fact]
        public async Task GetBlocksByCapability_WithValidCapability_ShouldReturn200()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks/by-capability/execution");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var blocks = JsonSerializer.Deserialize<List<BlockDto>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(blocks);
        }

        [Fact]
        public async Task GetBlocksByType_WithValidType_ShouldReturn200()
        {
            // Act
            var response = await _client.GetAsync("/api/discovery/blocks/by-type/Agent");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var content = await response.Content.ReadAsStringAsync();
            var blocks = JsonSerializer.Deserialize<List<BlockDto>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            
            Assert.NotNull(blocks);
        }
    }
}
