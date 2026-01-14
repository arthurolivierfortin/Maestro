using System;
using System.Collections.Generic;
using Maestro.Domain.Entities;
using Xunit;

namespace Maestro.Execution.Tests
{
    public class ExecutionContextTests
    {
        [Fact]
        public void CanSetAndGetBlockOutputAndVariables()
        {
            var ctx = ExecutionContext.Create("wf-test");
            ctx.SetBlockOutput("b1", "out", "value");
            var v = ctx.GetBlockOutput("b1", "out");
            Assert.Equal("value", v);

            ctx.LogInfo("started", "b1");
            ctx.LogError("err", null, "b1");
            ctx.Variables["x"] = 123;
            Assert.Equal(123, ctx.Variables["x"]);
        }
    }
}
