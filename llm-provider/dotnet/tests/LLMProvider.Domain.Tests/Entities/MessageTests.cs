using FluentAssertions;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Tests.Entities;

public class MessageTests
{
    [Fact]
    public void Constructor_WithValidContent_CreatesMessage()
    {
        // Arrange
        var id = MessageId.New();
        var content = "Hello, world!";

        // Act
        var message = new Message(id, MessageRole.User, content);

        // Assert
        message.Id.Should().Be(id);
        message.Role.Should().Be(MessageRole.User);
        message.Content.Should().Be(content);
        message.TokenUsage.Should().BeNull();
        message.Model.Should().BeNull();
        message.Provider.Should().BeNull();
    }

    [Fact]
    public void Constructor_WithAllParameters_SetsAllProperties()
    {
        // Arrange
        var id = MessageId.New();
        var tokenUsage = new TokenUsage(10, 20);
        var model = new ModelId("gpt-4");
        var createdAt = DateTimeOffset.UtcNow.AddHours(-1);

        // Act
        var message = new Message(
            id,
            MessageRole.Assistant,
            "Response content",
            tokenUsage,
            model,
            ProviderType.Azure,
            createdAt);

        // Assert
        message.Id.Should().Be(id);
        message.Role.Should().Be(MessageRole.Assistant);
        message.Content.Should().Be("Response content");
        message.TokenUsage.Should().Be(tokenUsage);
        message.Model.Should().Be(model);
        message.Provider.Should().Be(ProviderType.Azure);
        message.CreatedAt.Should().Be(createdAt);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_WithInvalidContent_ThrowsException(string? content)
    {
        // Act
        var act = () => new Message(MessageId.New(), MessageRole.User, content!);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("content");
    }

    [Fact]
    public void CreateUserMessage_CreatesUserRoleMessage()
    {
        // Act
        var message = Message.CreateUserMessage("Hello!");

        // Assert
        message.Id.Value.Should().NotBe(Guid.Empty);
        message.Role.Should().Be(MessageRole.User);
        message.Content.Should().Be("Hello!");
    }

    [Fact]
    public void CreateUserMessage_WithTokenUsage_SetsTokenUsage()
    {
        // Arrange
        var tokenUsage = new TokenUsage(10, 0);

        // Act
        var message = Message.CreateUserMessage("Hello!", tokenUsage);

        // Assert
        message.TokenUsage.Should().Be(tokenUsage);
    }

    [Fact]
    public void CreateSystemMessage_CreatesSystemRoleMessage()
    {
        // Act
        var message = Message.CreateSystemMessage("You are a helpful assistant.");

        // Assert
        message.Role.Should().Be(MessageRole.System);
        message.Content.Should().Be("You are a helpful assistant.");
    }

    [Fact]
    public void CreateAssistantMessage_CreatesAssistantRoleMessage()
    {
        // Arrange
        var tokenUsage = new TokenUsage(10, 20);
        var model = new ModelId("gpt-4");

        // Act
        var message = Message.CreateAssistantMessage(
            "I can help you!",
            tokenUsage,
            model,
            ProviderType.Azure);

        // Assert
        message.Role.Should().Be(MessageRole.Assistant);
        message.Content.Should().Be("I can help you!");
        message.TokenUsage.Should().Be(tokenUsage);
        message.Model.Should().Be(model);
        message.Provider.Should().Be(ProviderType.Azure);
    }

    [Fact]
    public void CreatedAt_DefaultsToCurrentTime()
    {
        // Arrange
        var before = DateTimeOffset.UtcNow;

        // Act
        var message = Message.CreateUserMessage("Hello!");

        // Assert
        var after = DateTimeOffset.UtcNow;
        message.CreatedAt.Should().BeOnOrAfter(before);
        message.CreatedAt.Should().BeOnOrBefore(after);
    }
}
