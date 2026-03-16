#nullable enable

using Xunit;
using Maestro.Infrastructure.Playground;

namespace Maestro.Execution.Tests
{
    public class PlaygroundTests
    {
        // ════════════════════════════════════════════════════════════════
        // 1 — ValidateJson: valid JSON with all fields → pass
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateJson_ValidJsonAllFields_Passes()
        {
            var json = "{\"name\":\"Alice\",\"age\":25,\"skills\":[\"C#\",\"TypeScript\"]}";
            var requiredFields = new[] { "name", "age", "skills" };

            var (passed, details) = CapabilityTestValidator.ValidateJson(json, requiredFields);

            Assert.True(passed, $"Expected pass but got: {details}");
            Assert.Contains("All required fields present", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 2 — ValidateJson: missing field → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateJson_MissingField_Fails()
        {
            var json = "{\"name\":\"Alice\",\"age\":25}";
            var requiredFields = new[] { "name", "age", "skills" };

            var (passed, details) = CapabilityTestValidator.ValidateJson(json, requiredFields);

            Assert.False(passed, "Expected fail for missing 'skills' field");
            Assert.Contains("skills", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 3 — ValidateJson: not JSON → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateJson_NotJson_Fails()
        {
            var response = "hello world, this is not JSON";
            var requiredFields = new[] { "name", "age", "skills" };

            var (passed, details) = CapabilityTestValidator.ValidateJson(response, requiredFields);

            Assert.False(passed, "Expected fail for non-JSON input");
            Assert.Contains("Invalid JSON", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 4 — ValidateJson: JSON in markdown block → pass (extracts)
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateJson_JsonInMarkdownBlock_Passes()
        {
            var response = "```json\n{\"name\":\"Alice\",\"age\":30,\"skills\":[\"Go\"]}\n```";
            var requiredFields = new[] { "name", "age", "skills" };

            var (passed, details) = CapabilityTestValidator.ValidateJson(response, requiredFields);

            Assert.True(passed, $"Expected pass for JSON in markdown block but got: {details}");
            Assert.Contains("All required fields present", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 5 — ValidateToolCall: valid tool call → pass
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateToolCall_Valid_Passes()
        {
            var response = "{\"tool\":\"search\",\"args\":{\"q\":\"test\"}}";

            var (passed, details) = CapabilityTestValidator.ValidateToolCall(response);

            Assert.True(passed, $"Expected pass but got: {details}");
            Assert.Contains("tool", details);
            Assert.Contains("args", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 6 — ValidateToolCall: missing args → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateToolCall_MissingArgs_Fails()
        {
            var response = "{\"tool\":\"search\"}";

            var (passed, details) = CapabilityTestValidator.ValidateToolCall(response);

            Assert.False(passed, "Expected fail for missing 'args' key");
            Assert.Contains("args", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 7 — ValidateToolCall: not JSON → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateToolCall_NotJson_Fails()
        {
            var response = "I'll search for that";

            var (passed, details) = CapabilityTestValidator.ValidateToolCall(response);

            Assert.False(passed, "Expected fail for non-JSON input");
            Assert.Contains("not valid JSON", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 8 — ValidateContains: all present → pass
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateContains_AllPresent_Passes()
        {
            var response = "Here is a function that checks if a number is prime and will return true or false.";
            var expectedTexts = new[] { "function", "return" };

            var (passed, details) = CapabilityTestValidator.ValidateContains(response, expectedTexts);

            Assert.True(passed, $"Expected pass but got: {details}");
            Assert.Contains("All expected content found", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 9 — ValidateContains: missing one → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateContains_MissingOne_Fails()
        {
            var response = "Here is a function that checks if a number is prime.";
            var expectedTexts = new[] { "function", "return", "class" };

            var (passed, details) = CapabilityTestValidator.ValidateContains(response, expectedTexts);

            Assert.False(passed, "Expected fail for missing 'class'");
            Assert.Contains("class", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 10 — ValidateLineCount: exact match → pass
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateLineCount_ExactMatch_Passes()
        {
            var response = "- Fast feedback loops\n- Catches regressions\n- Documents behavior";

            var (passed, details) = CapabilityTestValidator.ValidateLineCount(response, 3, "-");

            Assert.True(passed, $"Expected pass but got: {details}");
            Assert.Contains("exactly 3", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 11 — ValidateLineCount: too many → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateLineCount_TooMany_Fails()
        {
            var response = "- One\n- Two\n- Three\n- Four\n- Five";

            var (passed, details) = CapabilityTestValidator.ValidateLineCount(response, 3, "-");

            Assert.False(passed, "Expected fail for 5 lines when 3 expected");
            Assert.Contains("found 5", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 12 — ValidateContainsAny: has one → pass
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateContainsAny_HasOne_Passes()
        {
            var response = "Une API est une interface de programmation qui permet la communication entre applications.";
            var words = new[] { "le", "la", "les", "est", "une", "des" };

            var (passed, details) = CapabilityTestValidator.ValidateContainsAny(response, words);

            Assert.True(passed, $"Expected pass but got: {details}");
            Assert.Contains("matching word", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 13 — ValidateContainsAny: has none → fail
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void ValidateContainsAny_HasNone_Fails()
        {
            var response = "An API allows applications to communicate with each other through well-defined protocols.";
            var words = new[] { "le", "la", "les", "une", "des" };

            var (passed, details) = CapabilityTestValidator.ValidateContainsAny(response, words);

            Assert.False(passed, "Expected fail for English-only response");
            Assert.Contains("None of the expected words found", details);
        }

        // ════════════════════════════════════════════════════════════════
        // 14 — CapabilityTestDefinitions: 6 tests
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void CapabilityTestDefinitions_Returns6Tests()
        {
            var tests = CapabilityTestDefinitions.All;

            Assert.Equal(6, tests.Count);
        }

        // ════════════════════════════════════════════════════════════════
        // 15 — CapabilityTestDefinitions: each has required fields
        // ════════════════════════════════════════════════════════════════

        [Fact]
        public void CapabilityTestDefinitions_EachHasRequiredFields()
        {
            var tests = CapabilityTestDefinitions.All;

            foreach (var test in tests)
            {
                Assert.False(string.IsNullOrEmpty(test.Id), $"Test has empty Id");
                Assert.False(string.IsNullOrEmpty(test.Name), $"Test '{test.Id}' has empty Name");
                Assert.False(string.IsNullOrEmpty(test.Description), $"Test '{test.Id}' has empty Description");
                Assert.False(string.IsNullOrEmpty(test.SystemPrompt), $"Test '{test.Id}' has empty SystemPrompt");
                Assert.False(string.IsNullOrEmpty(test.UserPrompt), $"Test '{test.Id}' has empty UserPrompt");
            }
        }
    }
}
