using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
using Maestro.Application.DTOs;

namespace Maestro.Infrastructure.Tests
{
    /// <summary>
    /// Integration tests for BlocksController CRUD operations.
    /// Tests Phase 6A: Unified Block Source Architecture.
    /// </summary>
    public class BlocksControllerIntegrationTests : IClassFixture<WebApplicationFactory<Maestro.Api.Program>>
    {
        private readonly WebApplicationFactory<Maestro.Api.Program> _factory;
        private readonly HttpClient _client;

        public BlocksControllerIntegrationTests(WebApplicationFactory<Maestro.Api.Program> factory)
        {
            _factory = factory;
            _client = _factory.CreateClient();
        }

        [Fact]
        public async Task GetAll_ReturnsOkWithBlockList()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks");
            
            // Assert
            response.EnsureSuccessStatusCode();
            var blocks = await response.Content.ReadFromJsonAsync<List<BlockDto>>();
            Assert.NotNull(blocks);
        }

        [Fact]
        public async Task GetBlocks_WithTypeFilter_ReturnsFilteredResults()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks?type=prompt");
            
            // Assert
            response.EnsureSuccessStatusCode();
            var blocks = await response.Content.ReadFromJsonAsync<List<BlockDto>>();
            Assert.NotNull(blocks);
            Assert.All(blocks, b => Assert.Equal("prompt", b.BlockType, ignoreCase: true));
        }

        [Fact]
        public async Task GetBlocks_WithSearchQuery_ReturnsMatchingBlocks()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks?search=commit");
            
            // Assert
            response.EnsureSuccessStatusCode();
            var blocks = await response.Content.ReadFromJsonAsync<List<BlockDto>>();
            Assert.NotNull(blocks);
        }

        [Fact]
        public async Task Search_WithQuery_ReturnsResults()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks/search?q=test&limit=10");
            
            // Assert
            response.EnsureSuccessStatusCode();
            var blocks = await response.Content.ReadFromJsonAsync<List<BlockDto>>();
            Assert.NotNull(blocks);
            Assert.True(blocks.Count <= 10);
        }

        [Fact]
        public async Task GetBlockTypes_ReturnsAvailableTypes()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks/types");
            
            // Assert
            response.EnsureSuccessStatusCode();
            var types = await response.Content.ReadFromJsonAsync<List<string>>();
            Assert.NotNull(types);
            Assert.Contains("Prompt", types);
            Assert.Contains("Tool", types);
        }

        [Fact]
        public async Task GetById_WithNonExistentId_ReturnsNotFound()
        {
            // Act
            var response = await _client.GetAsync("/api/blocks/non-existent-block-id-12345");
            
            // Assert
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task CreateUpdateDelete_BlockLifecycle_Success()
        {
            // Arrange
            var createRequest = new CreateBlockRequest
            {
                Name = "Integration Test Block",
                BlockType = "prompt",
                Description = "Test block for integration testing",
                Tags = new List<string> { "test", "integration" },
                Capabilities = new List<string> { "text-generation" }
            };

            try
            {
                // Act 1: Create
                var createResponse = await _client.PostAsJsonAsync("/api/blocks", createRequest);
                createResponse.EnsureSuccessStatusCode();
                var created = await createResponse.Content.ReadFromJsonAsync<BlockDto>();
                Assert.NotNull(created);
                Assert.Equal(createRequest.Name, created.Name);
                Assert.Equal(createRequest.BlockType, created.BlockType);
                var blockId = created.Id;

                // Act 2: Get by ID
                var getResponse = await _client.GetAsync($"/api/blocks/{blockId}");
                getResponse.EnsureSuccessStatusCode();
                var fetched = await getResponse.Content.ReadFromJsonAsync<BlockDto>();
                Assert.NotNull(fetched);
                Assert.Equal(blockId, fetched.Id);

                // Act 3: Update
                var updateRequest = new UpdateBlockRequest
                {
                    Name = "Updated Integration Test Block",
                    Description = "Updated description"
                };
                var updateResponse = await _client.PutAsJsonAsync($"/api/blocks/{blockId}", updateRequest);
                updateResponse.EnsureSuccessStatusCode();
                var updated = await updateResponse.Content.ReadFromJsonAsync<BlockDto>();
                Assert.NotNull(updated);
                Assert.Equal(updateRequest.Name, updated.Name);

                // Act 4: Delete
                var deleteResponse = await _client.DeleteAsync($"/api/blocks/{blockId}");
                Assert.True(deleteResponse.StatusCode == HttpStatusCode.NoContent || deleteResponse.IsSuccessStatusCode);

                // Act 5: Verify deletion
                var verifyResponse = await _client.GetAsync($"/api/blocks/{blockId}");
                Assert.Equal(HttpStatusCode.NotFound, verifyResponse.StatusCode);
            }
            catch
            {
                // Cleanup: Try to delete the test block if it exists
                await _client.DeleteAsync($"/api/blocks/integration-test-block");
                throw;
            }
        }

        [Fact]
        public async Task Create_WithMissingRequiredFields_ReturnsBadRequest()
        {
            // Arrange
            var invalidRequest = new
            {
                description = "Missing name and blockType"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/api/blocks", invalidRequest);
            
            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Create_DuplicateBlock_ReturnsConflict()
        {
            // Arrange
            var createRequest = new CreateBlockRequest
            {
                Name = "Duplicate Test Block",
                BlockType = "prompt"
            };

            try
            {
                // Act 1: Create first instance
                var firstResponse = await _client.PostAsJsonAsync("/api/blocks", createRequest);
                firstResponse.EnsureSuccessStatusCode();
                var first = await firstResponse.Content.ReadFromJsonAsync<BlockDto>();
                var blockId = first?.Id;

                // Act 2: Try to create duplicate
                var duplicateResponse = await _client.PostAsJsonAsync("/api/blocks", createRequest);
                
                // Assert
                Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);

                // Cleanup
                if (blockId != null)
                    await _client.DeleteAsync($"/api/blocks/{blockId}");
            }
            catch
            {
                // Cleanup
                await _client.DeleteAsync($"/api/blocks/duplicate-test-block");
                throw;
            }
        }

        [Fact]
        public async Task Update_NonExistentBlock_ReturnsNotFound()
        {
            // Arrange
            var updateRequest = new UpdateBlockRequest
            {
                Name = "Updated Name"
            };

            // Act
            var response = await _client.PutAsJsonAsync("/api/blocks/non-existent-12345", updateRequest);
            
            // Assert
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Delete_NonExistentBlock_ReturnsNotFound()
        {
            // Act
            var response = await _client.DeleteAsync("/api/blocks/non-existent-12345");
            
            // Assert
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }
}
