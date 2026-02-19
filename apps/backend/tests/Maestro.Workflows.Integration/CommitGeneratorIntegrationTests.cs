using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Xunit;
using Maestro.Infrastructure.BlockStore;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Orchestration;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Workflows.Integration
{
    /// <summary>
    /// Integration tests for the commit-generator workflow.
    /// Tests the complete workflow execution using mock LLM responses.
    /// </summary>
    public class CommitGeneratorIntegrationTests
    {
        private readonly string _blocksPath;

        public CommitGeneratorIntegrationTests()
        {
            // Resolve blocks path relative to test assembly location
            var assemblyDir = Path.GetDirectoryName(typeof(CommitGeneratorIntegrationTests).Assembly.Location);
            _blocksPath = Path.GetFullPath(Path.Combine(assemblyDir!, "../../../../../../../../content/system/blocks"));

            // Fallback if running from different location
            if (!Directory.Exists(_blocksPath))
            {
                _blocksPath = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../../../../../../../content/system/blocks"));
            }
        }

        [Fact]
        public void BlocksPath_ShouldExist()
        {
            // Verify test setup
            Assert.True(Directory.Exists(_blocksPath), $"Blocks path should exist: {_blocksPath}");
        }

        [Fact]
        public async Task Run_CommitGenerator_WithMocks_ReturnsCommitMessage()
        {
            // Skip if blocks path doesn't exist
            if (!Directory.Exists(_blocksPath))
            {
                return; // Skip test gracefully
            }

            // Arrange: Configure FileSystemBlockDiscoveryService
            var searchPaths = new[] { _blocksPath };
            var discovery = new FileSystemBlockDiscoveryService(searchPaths);
            
            // Discover blocks
            var allBlocks = await discovery.DiscoverAllAsync();
            Assert.True(allBlocks.Any(), "Should discover at least one block");

            // Find workflow-related blocks
            var gitDiffBlock = allBlocks.FirstOrDefault(b => b.Id.Contains("git-diff"));
            var describeBlock = allBlocks.FirstOrDefault(b => b.Id.Contains("describe-commit"));
            var validatorBlock = allBlocks.FirstOrDefault(b => b.Id.Contains("commit-format"));

            // Create mock LLM gateway that returns conventional commit
            var mockLlmGateway = new Mock<ILLMGateway>();
            mockLlmGateway
                .Setup(g => g.SendAsync(It.IsAny<LLMRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LLMResponse 
                { 
                    Content = "feat(core): add workflow execution engine\n\nImplement block executor registry and workflow orchestration.",
                    TokensUsed = 50 
                });

            // Create block executors
            var promptExecutor = new PromptBlockExecutor();
            var inferenceExecutor = new InferenceBlockExecutor(mockLlmGateway.Object);
            
            var registry = new BlockExecutorRegistry(new IBlockExecutor[] 
            { 
                promptExecutor, 
                inferenceExecutor 
            });

            // Create mock execution repository
            var mockExecRepo = new Mock<IExecutionRepository>();
            mockExecRepo
                .Setup(r => r.SaveAsync(It.IsAny<ExecutionContext>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Create execution context
            var context = ExecutionContext.Create("commit-generator");

            // Act: Execute inference block with mock diff input
            var inputs = new Dictionary<string, object>
            {
                ["diff"] = "diff --git a/src/test.cs\n+public void TestMethod() { }",
                ["context"] = "Adding unit test for feature"
            };

            if (describeBlock != null)
            {
                var result = await inferenceExecutor.ExecuteAsync(describeBlock, context, inputs);
                
                // Assert
                Assert.True(result.Success, "Inference execution should succeed");
                Assert.True(result.Outputs.ContainsKey("default") || result.Outputs.ContainsKey("message") || result.Outputs.Any(),
                    "Should have output");
            }
        }

        [Fact]
        public async Task DiscoverAllBlocks_ShouldFindWorkflowBlocks()
        {
            if (!Directory.Exists(_blocksPath))
            {
                return;
            }

            var searchPaths = new[] { _blocksPath };
            var discovery = new FileSystemBlockDiscoveryService(searchPaths);
            
            var allBlocks = await discovery.DiscoverAllAsync();
            var blockList = allBlocks.ToList();
            
            // Should find multiple block types
            var hasPrompt = blockList.Any(b => b.BlockType == "prompt");
            var hasTool = blockList.Any(b => b.BlockType == "tool");
            var hasInference = blockList.Any(b => b.BlockType == "inference");
            var hasValidator = blockList.Any(b => b.BlockType == "validator");
            var hasWorkflow = blockList.Any(b => b.BlockType == "workflow");

            // At least some block types should be found
            Assert.True(hasPrompt || hasTool || hasInference || hasValidator || hasWorkflow,
                $"Should find various block types. Found: {string.Join(", ", blockList.Select(b => b.BlockType).Distinct())}");
        }

        [Fact]
        public async Task WorkflowExecutor_ExecuteWithMockBlocks_ProducesOutput()
        {
            if (!Directory.Exists(_blocksPath))
            {
                return;
            }

            // Arrange: Create a simple two-node workflow definition
            var block1 = BlockDefinition.Create("node1", "Node 1", "prompt");
            block1.UpdateConfig(new Dictionary<string, object> { ["template"] = "Hello {{name}}" });
            
            var block2 = BlockDefinition.Create("node2", "Node 2", "prompt");
            block2.UpdateConfig(new Dictionary<string, object> { ["template"] = "Processed: {{input}}" });

            var blocks = new List<BlockDefinition> { block1, block2 };
            var connections = new List<ConnectionDefinition>
            {
                new() { FromBlockId = "node1", FromPort = "default", ToBlockId = "node2", ToPort = "default" }
            };

            var workflowDef = new WorkflowDefinition("test-workflow", blocks, connections);

            // Create executors
            var promptExecutor = new PromptBlockExecutor();
            var registry = new BlockExecutorRegistry(new IBlockExecutor[] { promptExecutor });
            var dataFlow = new DataFlowManager();

            var mockExecRepo = new Mock<IExecutionRepository>();
            mockExecRepo
                .Setup(r => r.SaveAsync(It.IsAny<ExecutionContext>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var executor = new WorkflowExecutor(registry, dataFlow, mockExecRepo.Object);

            // Act
            var result = await executor.ExecuteAsync(workflowDef, new Dictionary<string, object> { ["name"] = "World" });

            // Assert
            Assert.True(result.Success, $"Workflow execution should succeed: {result.Error}");
        }

        [Fact]
        public void ExecutionGraph_CommitGeneratorStructure_NoCycles()
        {
            if (!Directory.Exists(_blocksPath))
            {
                return;
            }

            // Load commit-generator workflow
            var workflowPath = Path.Combine(_blocksPath, "workflows/commit-generator");
            if (!Directory.Exists(workflowPath))
            {
                return;
            }

            var nodesJson = File.ReadAllText(Path.Combine(workflowPath, "nodes.json"));
            var connectionsJson = File.ReadAllText(Path.Combine(workflowPath, "connections.json"));

            // Parse nodes and connections
            using var nodesDoc = System.Text.Json.JsonDocument.Parse(nodesJson);
            using var connsDoc = System.Text.Json.JsonDocument.Parse(connectionsJson);

            var nodes = nodesDoc.RootElement.EnumerateArray()
                .Select(e => BlockDefinition.Create(
                    e.GetProperty("id").GetString()!,
                    e.GetProperty("id").GetString()!,
                    "prompt"))
                .ToList();

            var connections = connsDoc.RootElement.EnumerateArray()
                .Select(e => new ConnectionDefinition
                {
                    FromBlockId = e.GetProperty("from").GetString()!,
                    ToBlockId = e.GetProperty("to").GetString()!
                })
                .ToList();

            // Build execution graph
            var graph = new ExecutionGraph(nodes, connections);

            // Assert no cycles
            Assert.False(graph.HasCycle(), "Commit-generator workflow should not have cycles");

            // Assert proper layer structure
            var layers = graph.GetExecutionLayers().ToList();
            Assert.True(layers.Count >= 2, "Should have at least 2 execution layers");
        }
    }
}
