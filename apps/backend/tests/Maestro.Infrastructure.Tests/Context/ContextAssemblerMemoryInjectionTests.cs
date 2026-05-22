using System.Collections.Generic;
using System.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Moq;

namespace Maestro.Infrastructure.Tests.Context;

public class ContextAssemblerMemoryInjectionTests
{
    [Fact]
    public async Task ContextAssembler_InjectsMemoryEntries_IntoSystemPrompt()
    {
        var convMgr = new Mock<IConversationManager>();
        convMgr.Setup(c => c.GetMessages(It.IsAny<string>())).Returns(new List<ChatMessage>
        {
            new() { Role = "system", Content = "Base prompt" }
        });

        var memProv = new Mock<IMemoryProvider>();
        memProv.Setup(m => m.GetRelevantEntriesAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<IEnumerable<string>>(),
                It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MemoryEntry>
            {
                new() { Key = "fact1", Content = "Sky is blue", Confidence = 1.0 }
            });

        var factory = new ContextProcessorFactory();
        var assembler = new ContextAssembler(convMgr.Object, factory, memProv.Object);

        var result = await assembler.AssembleAsync("conv1", new ContextConfig { Strategy = "passthrough" });

        // Passthrough re-injects the (modified) system prompt as the first system message.
        var systemMessage = result.Messages.FirstOrDefault(m => m.Role == "system");
        Assert.NotNull(systemMessage);
        Assert.Contains("Relevant Knowledge", systemMessage!.Content);
        Assert.Contains("Sky is blue", systemMessage.Content);
        Assert.Contains("Base prompt", systemMessage.Content);
    }
}
