using System;
using System.IO;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class HandlerTests
    {
        [Fact]
        public void ToolHandler_LoadsScriptAndSchema()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-tool-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": \"tool1\", \"blockType\": \"tool\", \"config\": { \"scriptFile\": \"script.sh\", \"schemaFile\": \"schema.json\" } }");
                File.WriteAllText(Path.Combine(temp, "script.sh"), "#!/bin/sh\necho hi");
                File.WriteAllText(Path.Combine(temp, "schema.json"), "{ \"type\": \"object\" }");

                var handler = new Maestro.Infrastructure.BlockStore.Handlers.ToolBlockHandler();
                var def = handler.Load(temp);

                Assert.NotNull(def);
                Assert.True(def!.Config.ContainsKey("script"));
                Assert.True(def.Config.ContainsKey("schema"));
            }
            finally { Directory.Delete(temp, true); }
        }

        [Fact]
        public void AgentHandler_LoadsSystemPrompt()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-agent-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": \"agent1\", \"blockType\": \"agent\" }");
                File.WriteAllText(Path.Combine(temp, "system-prompt.md"), "You are an agent");

                var handler = new Maestro.Infrastructure.BlockStore.Handlers.AgentBlockHandler();
                var def = handler.Load(temp);

                Assert.NotNull(def);
                Assert.True(def!.Config.ContainsKey("systemPrompt"));
            }
            finally { Directory.Delete(temp, true); }
        }

        [Fact]
        public void WorkflowHandler_LoadsNodesAndConnections()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-wf-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                File.WriteAllText(Path.Combine(temp, "block.json"), "{ \"id\": \"wf1\", \"blockType\": \"workflow\" }");
                File.WriteAllText(Path.Combine(temp, "nodes.json"), "{ \"nodes\": [] }");
                File.WriteAllText(Path.Combine(temp, "connections.json"), "{ \"connections\": [] }");

                var handler = new Maestro.Infrastructure.BlockStore.Handlers.WorkflowBlockHandler();
                var def = handler.Load(temp);

                Assert.NotNull(def);
                Assert.True(def!.Config.ContainsKey("nodes"));
                Assert.True(def.Config.ContainsKey("connections"));
            }
            finally { Directory.Delete(temp, true); }
        }
    }
}
