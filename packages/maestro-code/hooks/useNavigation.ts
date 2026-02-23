/**
 * useNavigation — Agent-in-the-Cockpit navigation state.
 *
 * Manages two independent screen positions:
 * - userScreen: where the user is looking
 * - agentScreen: where the agent is working
 *
 * Three interactions:
 * - joinAgent(): user teleports to agent's current screen
 * - detach(): user navigates freely, agent continues
 * - navigate(screen): user navigates to a specific screen
 *
 * When followingAgent is true, user screen tracks agent screen automatically.
 */

import { useState, useCallback } from 'react';
import type { Screen, AgentState } from '../types.ts';
import { screenEquals } from '../types.ts';

interface UseNavigationReturn {
  userScreen: Screen;
  agentScreen: Screen;
  followingAgent: boolean;
  agentState: AgentState;
  agentIsHere: boolean;
  navHistory: Screen[];

  // User actions
  navigate: (screen: Screen) => void;
  goBack: () => void;
  joinAgent: () => void;
  detach: () => void;

  // Agent actions (called by session manager / agent events)
  agentNavigate: (screen: Screen) => void;
  setAgentState: (state: AgentState) => void;
}

export function useNavigation(): UseNavigationReturn {
  const [userScreen, setUserScreen] = useState<Screen>({ type: 'agent' });
  const [agentScreen, setAgentScreen] = useState<Screen>({ type: 'agent' });
  const [followingAgent, setFollowingAgent] = useState<boolean>(true);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [navHistory, setNavHistory] = useState<Screen[]>([]);

  const agentIsHere = screenEquals(userScreen, agentScreen);

  // User navigates to a screen
  const navigate = useCallback((screen: Screen) => {
    setNavHistory(prev => [...prev, userScreen]);
    setUserScreen(screen);
    // Detach from agent when user navigates manually
    if (!screenEquals(screen, agentScreen)) {
      setFollowingAgent(false);
    }
  }, [userScreen, agentScreen]);

  // User goes back
  const goBack = useCallback(() => {
    setNavHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const lastScreen = newHistory.pop()!;
      setUserScreen(lastScreen);
      return newHistory;
    });
  }, []);

  // User joins agent (teleports to agent's screen)
  const joinAgent = useCallback(() => {
    setFollowingAgent(true);
    setUserScreen(agentScreen);
  }, [agentScreen]);

  // User detaches from agent
  const detach = useCallback(() => {
    setFollowingAgent(false);
  }, []);

  // Agent navigates to a screen (called by agent events)
  const agentNavigate = useCallback((screen: Screen) => {
    setAgentScreen(screen);
    if (followingAgent) {
      setUserScreen(screen);
    }
  }, [followingAgent]);

  return {
    userScreen,
    agentScreen,
    followingAgent,
    agentState,
    agentIsHere,
    navHistory,
    navigate,
    goBack,
    joinAgent,
    detach,
    agentNavigate,
    setAgentState,
  };
}
