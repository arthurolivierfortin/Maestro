using FluentAssertions;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Tests.ValueObjects;

public class ConversationIdTests
{
    [Fact]
    public void Constructor_WithValidGuid_CreatesInstance()
    {
        // Arrange
        var guid = Guid.NewGuid();

        // Act
        var id = new ConversationId(guid);

        // Assert
        id.Value.Should().Be(guid);
    }

    [Fact]
    public void Constructor_WithEmptyGuid_ThrowsException()
    {
        // Act
        var act = () => new ConversationId(Guid.Empty);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("value");
    }

    [Fact]
    public void New_CreatesUniqueIds()
    {
        // Act
        var id1 = ConversationId.New();
        var id2 = ConversationId.New();

        // Assert
        id1.Should().NotBe(id2);
        id1.Value.Should().NotBe(Guid.Empty);
        id2.Value.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Parse_WithValidString_ReturnsId()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var stringValue = guid.ToString();

        // Act
        var id = ConversationId.Parse(stringValue);

        // Assert
        id.Value.Should().Be(guid);
    }

    [Fact]
    public void Parse_WithInvalidString_ThrowsException()
    {
        // Act
        var act = () => ConversationId.Parse("not-a-guid");

        // Assert
        act.Should().Throw<FormatException>();
    }

    [Fact]
    public void TryParse_WithValidString_ReturnsTrue()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var stringValue = guid.ToString();

        // Act
        var result = ConversationId.TryParse(stringValue, out var id);

        // Assert
        result.Should().BeTrue();
        id.Value.Should().Be(guid);
    }

    [Fact]
    public void TryParse_WithInvalidString_ReturnsFalse()
    {
        // Act
        var result = ConversationId.TryParse("not-a-guid", out var id);

        // Assert
        result.Should().BeFalse();
        id.Should().Be(default(ConversationId));
    }

    [Fact]
    public void TryParse_WithEmptyGuidString_ReturnsFalse()
    {
        // Act
        var result = ConversationId.TryParse(Guid.Empty.ToString(), out var id);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ToString_ReturnsGuidString()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var id = new ConversationId(guid);

        // Act
        var result = id.ToString();

        // Assert
        result.Should().Be(guid.ToString());
    }

    [Fact]
    public void ImplicitConversion_ToGuid_ReturnsValue()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var id = new ConversationId(guid);

        // Act
        Guid result = id;

        // Assert
        result.Should().Be(guid);
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var id1 = new ConversationId(guid);
        var id2 = new ConversationId(guid);

        // Assert
        id1.Should().Be(id2);
        (id1 == id2).Should().BeTrue();
    }
}
