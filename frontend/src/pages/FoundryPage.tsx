/**
 * Foundry Page
 *
 * Unified interface for creating, managing, and discovering all block types,
 * agents, tools, and templates.
 *
 * Tab structure:
 * - Blocks: Atomic blocks (prompt, instruction, command, decision, etc.)
 * - Agents: AgentDefinition entities
 * - Tools: ToolDefinition entities (reusable workflows)
 * - Templates: Pre-built configurations
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Wrench, GitBranch } from 'lucide-react';
import { useBlockStore } from '../store';
import type { BlockType } from '../types/block.types';
import { FoundrySidebar } from '../components/Foundry/FoundrySidebar';
import { FoundrySearchBar } from '../components/Foundry/FoundrySearchBar';
import { BlockGrid } from '../components/Foundry/BlockGrid';
import { CreateBlockWizard } from '../components/Foundry/CreateBlockWizard';
import { useFavorites } from '../hooks/useFavorites';
import './FoundryPage.scss';

type FoundryTab = 'blocks' | 'agents' | 'tools' | 'templates';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Agent from API
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  capabilities: string[];
  tags: string[];
  totalRuns: number;
  completionRate: number;
  overallScore: number;
}

// Tool from API
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  tags: string[];
  totalRuns: number;
  successRate: number;
  overallScore: number;
}

// Template placeholder
interface Template {
  id: string;
  name: string;
  description: string;
  type: 'workflow' | 'agent' | 'tool';
  tags: string[];
}

export function FoundryPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Initialize from URL parameter or default to 'blocks'
  const getInitialTab = (): FoundryTab => {
    if (tab && ['blocks', 'agents', 'tools', 'templates'].includes(tab)) {
      return tab as FoundryTab;
    }
    return 'blocks';
  };

  const [activeTab, setActiveTab] = useState<FoundryTab>(getInitialTab);
  const [selectedCategory, setSelectedCategory] = useState<BlockType | 'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Data loaded from API
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [templates] = useState<Template[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);

  // Load agents from API
  useEffect(() => {
    if (activeTab === 'agents' && agents.length === 0 && !loadingAgents) {
      setLoadingAgents(true);
      fetch(`${API_BASE}/api/agents`)
        .then(res => res.json())
        .then(data => {
          setAgents(data);
          setLoadingAgents(false);
        })
        .catch(err => {
          console.error('Failed to load agents:', err);
          setLoadingAgents(false);
        });
    }
  }, [activeTab, agents.length, loadingAgents]);

  // Load tools from API
  useEffect(() => {
    if (activeTab === 'tools' && tools.length === 0 && !loadingTools) {
      setLoadingTools(true);
      fetch(`${API_BASE}/api/tools`)
        .then(res => res.json())
        .then(data => {
          setTools(data);
          setLoadingTools(false);
        })
        .catch(err => {
          console.error('Failed to load tools:', err);
          setLoadingTools(false);
        });
    }
  }, [activeTab, tools.length, loadingTools]);

  // Sync tab from URL - always update when tab param changes
  useEffect(() => {
    if (tab && ['blocks', 'agents', 'tools', 'templates'].includes(tab)) {
      if (activeTab !== tab) {
        setActiveTab(tab as FoundryTab);
      }
    }
  }, [tab, activeTab]);

  // Use individual selectors to prevent re-renders on unrelated state changes
  const getAllBlocks = useBlockStore((s) => s.getAllBlocks);
  const searchBlocks = useBlockStore((s) => s.searchBlocks);
  const { getFavorites } = useFavorites();

  /**
   * Filter blocks based on current criteria
   */
  const filteredBlocks = useMemo(() => {
    let blocks = getAllBlocks();

    // Filter by favorites
    if (selectedCategory === 'favorites') {
      blocks = getFavorites();
    }
    // Filter by category (block type)
    else if (selectedCategory !== 'all') {
      blocks = blocks.filter((block) => block.blockType === selectedCategory);
    }

    // Filter by capability
    if (selectedCapability) {
      blocks = blocks.filter(
        (block) => block.capabilities && block.capabilities.includes(selectedCapability)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchBlocks(searchQuery);
      const searchIds = new Set(searchResults.map((b) => b.id));
      blocks = blocks.filter((block) => searchIds.has(block.id));
    }

    return blocks;
  }, [selectedCategory, selectedCapability, searchQuery, getAllBlocks, searchBlocks, getFavorites]);

  /**
   * Handle tab change
   */
  const handleTabChange = (newTab: FoundryTab) => {
    setActiveTab(newTab);
    navigate(`/foundry/${newTab}`);
  };

  /**
   * Handle category selection from sidebar
   */
  const handleCategorySelect = (category: BlockType | 'all' | 'favorites') => {
    setSelectedCategory(category);
  };

  /**
   * Handle search query change
   */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  /**
   * Handle capability filter
   */
  const handleCapabilityFilter = (capability: string | null) => {
    setSelectedCapability(capability);
  };

  /**
   * Handle create new block
   */
  const handleCreateBlock = () => {
    setIsWizardOpen(true);
  };

  /**
   * Handle close wizard
   */
  const handleCloseWizard = () => {
    setIsWizardOpen(false);
  };

  /**
   * Render content based on active tab
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'blocks':
        return (
          <div className="foundry-page__layout">
            {/* Sidebar - Category filters */}
            <FoundrySidebar
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              onCreateBlock={handleCreateBlock}
            />

            {/* Main content area */}
            <div className="foundry-page__main">
              {/* Search bar with filters */}
              <FoundrySearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearch}
                selectedCapability={selectedCapability}
                onCapabilityChange={handleCapabilityFilter}
              />

              {/* Block grid */}
              <BlockGrid blocks={filteredBlocks} />
            </div>
          </div>
        );

      case 'agents':
        return (
          <div className="foundry-page__content">
            <div className="foundry-page__content-header">
              <h2>Agents</h2>
              <p>Manage AI agents that can execute complex tasks autonomously.</p>
              <button className="btn-primary" onClick={handleCreateBlock}>
                + New Agent
              </button>
            </div>
            {loadingAgents ? (
              <div className="foundry-page__loading">Loading agents...</div>
            ) : agents.length === 0 ? (
              <div className="foundry-page__empty">
                <h3>No Agents</h3>
                <p>Create your first agent to get started with autonomous task execution.</p>
                <button className="btn-primary" onClick={handleCreateBlock}>
                  Create Agent
                </button>
              </div>
            ) : (
              <div className="foundry-page__grid">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="foundry-card foundry-card--clickable"
                    data-testid={`agent-card-${agent.id}`}
                    onClick={() => navigate(`/foundry/agents/${agent.id}`)}
                  >
                    <div className="foundry-card__header">
                      <span className="foundry-card__icon"><Bot size={18} /></span>
                      <h3>{agent.name}</h3>
                      <span className="foundry-card__category">{agent.category}</span>
                    </div>
                    <p className="foundry-card__description">{agent.description}</p>
                    <div className="foundry-card__tags">
                      {(agent.capabilities || []).slice(0, 3).map((cap) => (
                        <span key={cap} className="tag">{cap}</span>
                      ))}
                    </div>
                    <div className="foundry-card__footer">
                      <span className="foundry-card__version">v{agent.version}</span>
                      <span className="foundry-card__stats">
                        {agent.totalRuns} runs | Score: {agent.overallScore?.toFixed(0) || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'tools':
        return (
          <div className="foundry-page__content">
            <div className="foundry-page__content-header">
              <h2>Tools</h2>
              <p>Reusable tool definitions that agents can use to interact with external systems.</p>
              <button className="btn-primary" onClick={handleCreateBlock}>
                + New Tool
              </button>
            </div>
            {loadingTools ? (
              <div className="foundry-page__loading">Loading tools...</div>
            ) : tools.length === 0 ? (
              <div className="foundry-page__empty">
                <h3>No Tools</h3>
                <p>Create your first tool to extend agent capabilities.</p>
                <button className="btn-primary" onClick={handleCreateBlock}>
                  Create Tool
                </button>
              </div>
            ) : (
              <div className="foundry-page__grid">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="foundry-card foundry-card--clickable"
                    data-testid={`tool-card-${tool.id}`}
                    onClick={() => navigate(`/foundry/tools/${tool.id}`)}
                  >
                    <div className="foundry-card__header">
                      <span className="foundry-card__icon"><Wrench size={18} /></span>
                      <h3>{tool.name}</h3>
                    </div>
                    <p className="foundry-card__description">{tool.description}</p>
                    <div className="foundry-card__tags">
                      <span className="tag tag--category">{tool.category}</span>
                    </div>
                    <div className="foundry-card__footer">
                      <span className="foundry-card__version">v{tool.version}</span>
                      <span className="foundry-card__stats">
                        {tool.totalRuns} runs | Score: {tool.overallScore?.toFixed(0) || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'templates':
        return (
          <div className="foundry-page__content">
            <div className="foundry-page__content-header">
              <h2>Templates</h2>
              <p>Pre-built configurations for common workflows, agents, and tools.</p>
            </div>
            {templates.length === 0 ? (
              <div className="foundry-page__empty">
                <h3>No Templates</h3>
                <p>Templates will appear here once they are available.</p>
              </div>
            ) : (
              <div className="foundry-page__grid">
                {templates.map((template) => (
                  <div key={template.id} className="foundry-card">
                    <div className="foundry-card__header">
                      <span className="foundry-card__icon">
                        {template.type === 'workflow' ? <GitBranch size={18} /> : template.type === 'agent' ? <Bot size={18} /> : <Wrench size={18} />}
                      </span>
                      <h3>{template.name}</h3>
                    </div>
                    <p className="foundry-card__description">{template.description}</p>
                    <div className="foundry-card__tags">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="foundry-card__footer">
                      <span className="foundry-card__type">{template.type}</span>
                      <button className="btn-secondary btn-sm">Use Template</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="foundry-page">
      <div className="foundry-page__header">
        <div className="foundry-page__title-row">
          <h1 className="foundry-page__title">Foundry</h1>
          <button className="btn-primary" onClick={handleCreateBlock}>
            + New
          </button>
        </div>
        <p className="foundry-page__subtitle">
          Discover and manage all reusable components: blocks, agents, tools, and templates.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="foundry-page__tabs">
        <button
          className={`foundry-page__tab ${activeTab === 'blocks' ? 'foundry-page__tab--active' : ''}`}
          onClick={() => handleTabChange('blocks')}
        >
          Blocks
        </button>
        <button
          className={`foundry-page__tab ${activeTab === 'agents' ? 'foundry-page__tab--active' : ''}`}
          onClick={() => handleTabChange('agents')}
        >
          Agents
        </button>
        <button
          className={`foundry-page__tab ${activeTab === 'tools' ? 'foundry-page__tab--active' : ''}`}
          onClick={() => handleTabChange('tools')}
        >
          Tools
        </button>
        <button
          className={`foundry-page__tab ${activeTab === 'templates' ? 'foundry-page__tab--active' : ''}`}
          onClick={() => handleTabChange('templates')}
        >
          Templates
        </button>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Create Block Wizard Modal */}
      <CreateBlockWizard isOpen={isWizardOpen} onClose={handleCloseWizard} />
    </div>
  );
}

export default FoundryPage;
