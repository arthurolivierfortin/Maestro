import React, { useState } from 'react';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ModelSelector } from '../components/Chat/ModelSelector';
import './ChatPage.scss';

const ChatPage: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [temperature, setTemperature] = useState(0.7);
  const [showParams, setShowParams] = useState(false);

  return (
    <div className="chat-page page-enter">
      <div className="chat-page__header">
        <div className="chat-page__header-left">
          <h1 className="chat-page__title">Chat</h1>
          <button
            className="chat-page__params-toggle"
            onClick={() => setShowParams(!showParams)}
            title="Toggle parameters"
          >
            {showParams ? '▾' : '▸'} Params
          </button>
        </div>
        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
      </div>
      {showParams && (
        <div className="chat-page__params">
          <label className="chat-page__param">
            <span className="chat-page__param-label">Temperature</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="chat-page__param-slider"
            />
            <span className="chat-page__param-value">{temperature}</span>
          </label>
        </div>
      )}
      <div className="chat-page__body">
        <ChatPanel model={selectedModel} />
      </div>
    </div>
  );
};

export default ChatPage;
