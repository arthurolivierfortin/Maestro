/**
 * B-One Maestro Frontend Application
 * 
 * Desktop application UI for autonomous multi-agent workflow orchestration.
 * Architecture: Clean separation between UI and business logic.
 * Business logic resides in backend - frontend is purely presentational.
 */

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>B-One Maestro</h1>
        <p>Autonomous Multi-Agent Workflow Orchestrator</p>
      </header>

      <main className="main">
        <section className="info-card">
          <h2>🎯 Architecture Validation</h2>
          <p>This is a minimal "Hello World" to validate the project structure.</p>
          
          <div className="architecture-info">
            <h3>Backend (.NET)</h3>
            <ul>
              <li>✅ Domain Layer (pure C#, no dependencies)</li>
              <li>✅ Application Layer (use cases, interfaces)</li>
              <li>✅ Infrastructure Layer (implementations)</li>
              <li>✅ Presentation Layer (API + SignalR)</li>
              <li>✅ Agents Layer (specialized agents)</li>
            </ul>

            <h3>Frontend (TypeScript + React)</h3>
            <ul>
              <li>✅ Component structure</li>
              <li>✅ Type-safe throughout</li>
              <li>✅ No business logic (presentational only)</li>
            </ul>

            <h3>Project Structure</h3>
            <ul>
              <li>✅ Clean Architecture boundaries</li>
              <li>✅ SOLID principles</li>
              <li>✅ Model-agnostic design (ILLMGateway)</li>
              <li>✅ Monitoring infrastructure (IExecutionMonitor)</li>
              <li>✅ Artifact detection (.maestro directory)</li>
            </ul>
          </div>

          <div className="api-info">
            <h3>🔗 Backend API</h3>
            <p>API running at: <code>https://localhost:5001</code></p>
            <p>Test endpoint: <code>GET /api/workflows/hello</code></p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Architecture First | No Feature Logic | Clean Boundaries</p>
      </footer>
    </div>
  )
}

export default App
