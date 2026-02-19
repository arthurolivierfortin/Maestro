using FluentAssertions;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Tests.Entities;

public class ConversationTests
{
    [Fact]
    public void Create_WithNoParameters_CreatesEmptyConversation()
    {
        // Act
        var conversation = Conversation.Create();

        // Assert
        conversation.Id.Value.Should().NotBe(Guid.Empty);
        conversation.Title.Should().BeNull();
        conversation.IsEmpty.Should().BeTrue();
        conversation.MessageCount.Should().Be(0);
    }

    [Fact]
    public void Create_WithTitle_SetsTitle()
    {
        // Act
        var conversation = Conversation.Create(title: "Test Conversation");

        // Assert
        conversation.Title.Should().Be("Test Conversation");
    }

    [Fact]
    public void Create_WithSystemPrompt_AddsSystemMessage()
    {
        // Act
        var conversation = Conversation.Create(systemPrompt: "You are a helpful assistant.");

        // Assert
        conversation.IsEmpty.Should().BeFalse();
        conversation.MessageCount.Should().Be(1);
        conversation.Messages[0].Role.Should().Be(MessageRole.System);
        conversation.Messages[0].Content.Should().Be("You are a helpful assistant.");
    }

    [Fact]
    public void AddUserMessage_AddsMessageToConversation()
    {
        // Arrange
        var conversation = Conversation.Create();

        // Act
        var message = conversation.AddUserMessage("Hello!");

        // Assert
        conversation.MessageCount.Should().Be(1);
        conversation.Messages[0].Should().Be(message);
        message.Role.Should().Be(MessageRole.User);
        message.Content.Should().Be("Hello!");
    }

    [Fact]
    public void AddAssistantMessage_AddsMessageWithMetadata()
    {
        // Arrange
        var conversation = Conversation.Create();
        var tokenUsage = new TokenUsage(10, 20);
        var modelId = new ModelId("gpt-4");

        // Act
        var message = conversation.AddAssistantMessage(
            "Hi there!",
            tokenUsage,
            modelId,
            ProviderType.Azure);

        // Assert
        conversation.MessageCount.Should().Be(1);
        message.Role.Should().Be(MessageRole.Assistant);
        message.Content.Should().Be("Hi there!");
        message.TokenUsage.Should().Be(tokenUsage);
        message.Model.Should().Be(modelId);
        message.Provider.Should().Be(ProviderType.Azure);
    }

    [Fact]
    public void TotalTokenUsage_SumsAllMessageTokens()
    {
        // Arrange
        var conversation = Conversation.Create();
        conversation.AddUserMessage("Hello!");
        conversation.AddAssistantMessage(
            "Hi!",
            new TokenUsage(10, 5),
            new ModelId("gpt-4"),
            ProviderType.Azure);
        conversation.AddUserMessage("How are you?");
        conversation.AddAssistantMessage(
            "I'm fine!",
            new TokenUsage(15, 10),
            new ModelId("gpt-4"),
            ProviderType.Azure);

        // Act
        var totalUsage = conversation.TotalTokenUsage;

        // Assert
        totalUsage.PromptTokens.Should().Be(25);
        totalUsage.CompletionTokens.Should().Be(15);
        totalUsage.TotalTokens.Should().Be(40);
    }

    [Fact]
    public void GetLastMessages_ReturnsCorrectCount()
    {
        // Arrange
        var conversation = Conversation.Create();
        for (var i = 0; i < 10; i++)
        {
            conversation.AddUserMessage($"Message {i}");
        }

        // Act
        var lastMessages = conversation.GetLastMessages(3);

        // Assert
        lastMessages.Should().HaveCount(3);
        lastMessages[0].Content.Should().Be("Message 7");
        lastMessages[1].Content.Should().Be("Message 8");
        lastMessages[2].Content.Should().Be("Message 9");
    }

    [Fact]
    public void GetLastMessages_WithZeroCount_ReturnsEmpty()
    {
        // Arrange
        var conversation = Conversation.Create();
        conversation.AddUserMessage("Hello!");

        // Act
        var lastMessages = conversation.GetLastMessages(0);

        // Assert
        lastMessages.Should().BeEmpty();
    }

    [Fact]
    public void GetMessagesByRole_ReturnsFilteredMessages()
    {
        // Arrange
        var conversation = Conversation.Create(systemPrompt: "System message");
        conversation.AddUserMessage("User message 1");
        conversation.AddAssistantMessage(
            "Assistant message",
            new TokenUsage(10, 5),
            new ModelId("gpt-4"),
            ProviderType.Azure);
        conversation.AddUserMessage("User message 2");

        // Act
        var userMessages = conversation.GetMessagesByRole(MessageRole.User);
        var assistantMessages = conversation.GetMessagesByRole(MessageRole.Assistant);
        var systemMessages = conversation.GetMessagesByRole(MessageRole.System);

        // Assert
        userMessages.Should().HaveCount(2);
        assistantMessages.Should().HaveCount(1);
        systemMessages.Should().HaveCount(1);
    }

    [Fact]
    public void SetTitle_UpdatesTitle()
    {
        // Arrange
        var conversation = Conversation.Create(title: "Original Title");

        // Act
        conversation.SetTitle("New Title");

        // Assert
        conversation.Title.Should().Be("New Title");
    }

    [Fact]
    public void SetTitle_WithNull_ClearsTitle()
    {
        // Arrange
        var conversation = Conversation.Create(title: "Original Title");

        // Act
        conversation.SetTitle(null);

        // Assert
        conversation.Title.Should().BeNull();
    }

    [Fact]
    public void AddMessage_UpdatesUpdatedAt()
    {
        // Arrange
        var conversation = Conversation.Create();
        var originalUpdatedAt = conversation.UpdatedAt;

        // Small delay to ensure timestamp difference
        Thread.Sleep(10);

        // Act
        conversation.AddUserMessage("Hello!");

        // Assert
        conversation.UpdatedAt.Should().BeAfter(originalUpdatedAt);
    }

    [Fact]
    public void AddMessage_WithNull_ThrowsException()
    {
        // Arrange
        var conversation = Conversation.Create();

        // Act
        var act = () => conversation.AddMessage(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>();
    }
}
