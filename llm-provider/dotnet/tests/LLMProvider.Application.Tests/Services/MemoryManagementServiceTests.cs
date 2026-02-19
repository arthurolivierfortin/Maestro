using FluentAssertions;
using LLMProvider.Application.Services;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Tests.Services;

public class MemoryManagementServiceTests
{
    private readonly MemoryManagementService _service;

    public MemoryManagementServiceTests()
    {
        _service = new MemoryManagementService();
    }

    [Fact]
    public void GetMessagesForStrategy_Full_ReturnsAllMessages()
    {
        // Arrange
        var conversation = CreateConversationWithMessages(5);

        // Act
        var messages = _service.GetMessagesForStrategy(conversation, MemoryStrategy.Full);

        // Assert
        messages.Should().HaveCount(5);
    }

    [Fact]
    public void GetMessagesForStrategy_None_ReturnsEmpty()
    {
        // Arrange
        var conversation = CreateConversationWithMessages(5);

        // Act
        var messages = _service.GetMessagesForStrategy(conversation, MemoryStrategy.None);

        // Assert
        messages.Should().BeEmpty();
    }

    [Fact]
    public void GetMessagesForStrategy_Windowed_ReturnsLastNMessages()
    {
        // Arrange
        var conversation = CreateConversationWithMessages(10);
        var windowSize = 3;

        // Act
        var messages = _service.GetMessagesForStrategy(
            conversation,
            MemoryStrategy.Windowed,
            windowSize);

        // Assert
        messages.Should().HaveCount(3);
    }

    [Fact]
    public void GetMessagesForStrategy_Windowed_AlwaysIncludesSystemMessages()
    {
        // Arrange
        var conversation = Conversation.Create(systemPrompt: "You are helpful.");
        for (var i = 0; i < 10; i++)
        {
            conversation.AddUserMessage($"Message {i}");
        }
        var windowSize = 3;

        // Act
        var messages = _service.GetMessagesForStrategy(
            conversation,
            MemoryStrategy.Windowed,
            windowSize);

        // Assert
        // Should have 1 system message + 3 windowed messages
        messages.Should().HaveCount(4);
        messages[0].Role.Should().Be(MessageRole.System);
    }

    [Fact]
    public void GetMessagesForStrategy_Windowed_UsesDefaultWindowSize()
    {
        // Arrange
        var conversation = CreateConversationWithMessages(20);

        // Act
        var messages = _service.GetMessagesForStrategy(conversation, MemoryStrategy.Windowed);

        // Assert
        messages.Should().HaveCount(MemoryManagementService.DefaultWindowSize);
    }

    [Fact]
    public void GetMessagesForStrategy_Summarized_ReturnsSubsetOfMessages()
    {
        // Arrange
        var conversation = Conversation.Create(systemPrompt: "System prompt.");
        for (var i = 0; i < 10; i++)
        {
            conversation.AddUserMessage($"Message {i}");
        }

        // Act
        var messages = _service.GetMessagesForStrategy(conversation, MemoryStrategy.Summarized);

        // Assert
        // Summarized currently returns system + last 2 messages
        messages.Should().HaveCount(3);
        messages[0].Role.Should().Be(MessageRole.System);
    }

    [Fact]
    public void EstimateTokenCount_ReturnsApproximation()
    {
        // Arrange
        var conversation = Conversation.Create();
        conversation.AddUserMessage("Hello, how are you?"); // ~20 chars = ~5 tokens

        // Act
        var estimate = MemoryManagementService.EstimateTokenCount(conversation.Messages);

        // Assert
        estimate.Should().BeGreaterThan(0);
        estimate.Should().BeLessThan(20); // Reasonable upper bound
    }

    [Fact]
    public void TrimToTokenBudget_KeepsSystemMessages()
    {
        // Arrange
        var conversation = Conversation.Create(systemPrompt: "System.");
        for (var i = 0; i < 10; i++)
        {
            conversation.AddUserMessage($"User message {i} with some content.");
        }

        var messages = conversation.Messages.ToList();
        var lowBudget = 20;

        // Act
        var trimmed = _service.TrimToTokenBudget(messages, lowBudget);

        // Assert
        trimmed.Should().Contain(m => m.Role == MessageRole.System);
        trimmed.Count.Should().BeLessThan(messages.Count);
    }

    [Fact]
    public void TrimToTokenBudget_KeepsRecentMessagesFirst()
    {
        // Arrange
        var conversation = Conversation.Create();
        conversation.AddUserMessage("First message");
        conversation.AddUserMessage("Second message");
        conversation.AddUserMessage("Third message");
        conversation.AddUserMessage("Fourth message");

        var messages = conversation.Messages.ToList();
        var budget = 10; // Very low budget

        // Act
        var trimmed = _service.TrimToTokenBudget(messages, budget);

        // Assert
        // Should keep the most recent messages that fit
        if (trimmed.Count > 0)
        {
            trimmed.Last().Content.Should().Contain("Fourth");
        }
    }

    private static Conversation CreateConversationWithMessages(int count)
    {
        var conversation = Conversation.Create();
        for (var i = 0; i < count; i++)
        {
            conversation.AddUserMessage($"Message {i}");
        }
        return conversation;
    }
}
