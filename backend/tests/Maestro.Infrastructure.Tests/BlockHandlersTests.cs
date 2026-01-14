using System;
using System.IO;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class BlockHandlersTests
    {
        [Fact]
        public void PromptHandler_LoadsTemplate_WhenTemplateExists()
        {
            var temp = Path.Combine(Path.GetTempPath(), "maestro-test-prompt-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                File.WriteAllText(Path.Combine(temp, "block.json"), "{\"id\": \"test-prompt\", \"blockType\": \"prompt\"}");
                File.WriteAllText(Path.Combine(temp, "template.md"), "Hello world");

                var handler = new Maestro.Infrastructure.BlockStore.Handlers.PromptBlockHandler();
                var def = handler.Load(temp);

                Assert.NotNull(def);
                Assert.True(def!.Config.ContainsKey("template") || def.Config.ContainsKey("templateFile"));
            }
            finally
            {
                Directory.Delete(temp, true);
            }
        }
    }
}
