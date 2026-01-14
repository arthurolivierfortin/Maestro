using System;
using System.IO;
using System.Threading.Tasks;
using Xunit;
using Maestro.Infrastructure.BlockStore;

namespace Maestro.Infrastructure.Tests
{
    public class ValidatorTests
    {
        [Fact]
        public async Task ValidateBlockJson_ReturnsErrors_ForInvalidBlock()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-validate-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                // Write an invalid block.json (missing required fields)
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": 123 }");

                var validator = new Maestro.Infrastructure.BlockStore.JsonSchemaBlockValidator();
                var res = await validator.ValidateAsync(File.ReadAllText(Path.Combine(temp, "block.json")));

                Assert.False(res.IsValid);
                Assert.NotEmpty(res.Errors);
            }
            finally
            {
                Directory.Delete(temp, true);
            }
        }

        [Fact]
        public async Task ValidateFolder_ReturnsErrors_WhenWorkflowNodesInvalid()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-validate-folder-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                // Create a workflow block.json
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": \"wf1\", \"blockType\": \"workflow\" }");
                // nodes.json invalid
                File.WriteAllText(Path.Combine(temp, "nodes.json"), "{ \"nodes\": [ { } ] }");

                var validator = new Maestro.Infrastructure.BlockStore.JsonSchemaBlockValidator();
                var res = await validator.ValidateFolderAsync(temp);

                Assert.False(res.IsValid);
                Assert.NotEmpty(res.Errors);
            }
            finally
            {
                Directory.Delete(temp, true);
            }
        }

        [Fact]
        public async Task ValidateFolder_ReturnsErrors_ForInvalidConnectionReferences()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-validate-conns-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                // workflow block
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": \"wf2\", \"blockType\": \"workflow\" }");
                File.WriteAllText(Path.Combine(temp, "nodes.json"), "{ \"nodes\": [ { \"id\": \"n1\", \"ports\": [ { \"id\": \"out\" } ] } ] }");
                // connections referencing non-existent node/port
                File.WriteAllText(Path.Combine(temp, "connections.json"), "{ \"connections\": [ { \"from\": { \"nodeId\": \"n1\", \"portId\": \"out\" }, \"to\": { \"nodeId\": \"n2\", \"portId\": \"in\" } } ] }");

                var validator = new Maestro.Infrastructure.BlockStore.JsonSchemaBlockValidator();
                var res = await validator.ValidateFolderAsync(temp);

                Assert.False(res.IsValid);
                Assert.NotEmpty(res.Errors);
            }
            finally { Directory.Delete(temp, true); }
        }
    }
}
