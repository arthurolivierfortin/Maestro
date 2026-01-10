/**
 * Home Page
 */

import { Link } from 'react-router-dom';
import { Button } from '@components/common/Button';
import './HomePage.scss';

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1 className="hero__title">Welcome to B-One Maestro</h1>
        <p className="hero__subtitle">
          Autonomous Multi-Agent Workflow Orchestrator for Software Engineering Tasks
        </p>
        <div className="hero__actions">
          <Link to="/workflows/new">
            <Button variant="primary" size="lg">
              Create New Workflow
            </Button>
          </Link>
          <Link to="/workflows">
            <Button variant="secondary" size="lg">
              View Workflows
            </Button>
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Key Features</h2>
        <div className="features__grid">
          <div className="feature-card">
            <h3>🎯 Workflow-First Architecture</h3>
            <p>
              Build and visualize multi-agent workflows through an intuitive drag-and-drop interface
            </p>
          </div>
          <div className="feature-card">
            <h3>🤖 Model-Agnostic Platform</h3>
            <p>
              Complete independence from any specific LLM or AI model through abstraction layers
            </p>
          </div>
          <div className="feature-card">
            <h3>🔄 Agent Orchestration</h3>
            <p>Coordinate specialized agents (Planner, Tester, Coder, Reviewer) working together</p>
          </div>
          <div className="feature-card">
            <h3>📊 Comprehensive Monitoring</h3>
            <p>Real-time observability of workflow execution with live terminal output</p>
          </div>
        </div>
      </section>

      <section className="getting-started">
        <h2>Getting Started</h2>
        <ol>
          <li>Create a new workflow or choose from templates</li>
          <li>Add and configure nodes (Agents, Tools, Decisions)</li>
          <li>Connect nodes to define execution flow</li>
          <li>Execute and monitor your workflow in real-time</li>
        </ol>
      </section>
    </div>
  );
}

export default HomePage;
