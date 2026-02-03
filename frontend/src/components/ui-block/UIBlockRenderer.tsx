/**
 * UIBlockRenderer - Renders custom UI blocks from workspaces
 * Following Maestro Philosophy: "Tout est un Block"
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { UIBlock, UIDisplayMode } from '../../types/ui-block.types';
import { workspaceService } from '../../services/workspaceService';
import { sessionService } from '../../services/sessionService';
import './UIBlockRenderer.scss';

interface UIBlockRendererProps {
  blockId: string;
  workspaceId: string;
  displayMode?: UIDisplayMode;
  className?: string;
}

export function UIBlockRenderer({
  blockId,
  workspaceId,
  displayMode = 'panel',
  className = ''
}: UIBlockRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [block, setBlock] = useState<UIBlock | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load UI block definition and content
  useEffect(() => {
    async function loadBlock() {
      setIsLoading(true);
      setError(null);

      try {
        // Get the UI block definition
        const uiBlock = await workspaceService.getUIBlock(workspaceId, blockId);
        setBlock(uiBlock);

        // Fetch content
        const blockContent = await workspaceService.getUIBlockContent(workspaceId, blockId);
        setContent(blockContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load UI block');
      } finally {
        setIsLoading(false);
      }
    }

    loadBlock();
  }, [blockId, workspaceId]);

  // Handle messages from iframe
  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (!iframeRef.current) return;

    const { type, payload } = event.data || {};
    if (!type || !type.startsWith('maestro:')) return;

    const iframe = iframeRef.current;

    switch (type) {
      case 'maestro:getSessions':
        try {
          const sessions = await sessionService.getSessionsForWorkspace(workspaceId);
          iframe.contentWindow?.postMessage({
            type: 'maestro:sessions',
            payload: sessions
          }, '*');
        } catch (err) {
          iframe.contentWindow?.postMessage({
            type: 'maestro:error',
            payload: { error: 'Failed to fetch sessions' }
          }, '*');
        }
        break;

      case 'maestro:getBlocks':
        // TODO: Implement block fetching via block service
        iframe.contentWindow?.postMessage({
          type: 'maestro:blocks',
          payload: []
        }, '*');
        break;

      case 'maestro:subscribe':
        // TODO: Implement real-time subscriptions via SignalR
        console.log('UI Block subscribed to:', payload);
        break;

      case 'maestro:execute':
        // TODO: Implement block execution
        console.log('UI Block requested execution:', payload);
        break;
    }
  }, [workspaceId]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Inject API context into iframe once loaded
  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current || !block) return;

    // Send initial context to iframe
    iframeRef.current.contentWindow?.postMessage({
      type: 'maestro:init',
      payload: {
        workspaceId,
        blockId,
        config: block.config,
        permissions: block.config.permissions
      }
    }, '*');
  }, [workspaceId, blockId, block]);

  if (isLoading) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--loading ${className}`}>
        <div className="ui-block-renderer__spinner" />
        <span>Loading UI...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--error ${className}`}>
        <span className="ui-block-renderer__error-icon">!</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`ui-block-renderer ui-block-renderer--empty ${className}`}>
        <span>No UI content available</span>
      </div>
    );
  }

  // Inject the Maestro API script into the content
  const contentWithApi = injectMaestroAPI(content);

  const sandboxPermissions = block?.config.sandbox
    ? 'allow-scripts'
    : 'allow-scripts allow-same-origin';

  return (
    <div className={`ui-block-renderer ui-block-renderer--${displayMode} ${className}`}>
      <iframe
        ref={iframeRef}
        srcDoc={contentWithApi}
        sandbox={sandboxPermissions}
        onLoad={handleIframeLoad}
        title={block?.name || 'UI Block'}
        className="ui-block-renderer__iframe"
      />
    </div>
  );
}

/**
 * Inject the Maestro API script into HTML content
 */
function injectMaestroAPI(htmlContent: string): string {
  const apiScript = `
<script>
window.MaestroAPI = {
  _callbacks: {},
  _subscriptions: {},
  context: null,

  init(ctx) {
    this.context = ctx;
  },

  _handleMessage(event) {
    const { type, payload } = event.data || {};
    if (!type || !type.startsWith('maestro:')) return;

    const eventType = type.replace('maestro:', '');

    if (this._callbacks[eventType]) {
      this._callbacks[eventType].forEach(cb => cb(payload));
      delete this._callbacks[eventType];
    }

    if (this._subscriptions[eventType]) {
      this._subscriptions[eventType].forEach(cb => cb(payload));
    }
  },

  _request(type, payload = {}) {
    return new Promise((resolve) => {
      if (!this._callbacks[type]) {
        this._callbacks[type] = [];
      }
      this._callbacks[type].push(resolve);

      window.parent.postMessage({
        type: 'maestro:' + type,
        payload
      }, '*');
    });
  },

  async getSessions() {
    return this._request('getSessions');
  },

  async getBlocks() {
    return this._request('getBlocks');
  },

  async getMetrics() {
    return this._request('getMetrics');
  },

  subscribe(event, callback) {
    if (!this._subscriptions[event]) {
      this._subscriptions[event] = [];
    }
    this._subscriptions[event].push(callback);

    window.parent.postMessage({
      type: 'maestro:subscribe',
      payload: { event }
    }, '*');

    return () => {
      this._subscriptions[event] = this._subscriptions[event].filter(cb => cb !== callback);
    };
  },

  async execute(blockId, input) {
    return this._request('execute', { blockId, input });
  }
};

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'maestro:init') {
    window.MaestroAPI.init(event.data.payload);
    window.dispatchEvent(new CustomEvent('maestro:ready', {
      detail: event.data.payload
    }));
  } else {
    window.MaestroAPI._handleMessage(event);
  }
});
</script>
`;

  // Inject script before closing head tag, or at the start of body
  if (htmlContent.includes('</head>')) {
    return htmlContent.replace('</head>', apiScript + '</head>');
  } else if (htmlContent.includes('<body>')) {
    return htmlContent.replace('<body>', '<body>' + apiScript);
  } else {
    return apiScript + htmlContent;
  }
}

export default UIBlockRenderer;
