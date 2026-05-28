import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonitorPage } from '../MonitorPage';

vi.mock('../../hooks/useCostData', () => ({
  useCostData: vi.fn(),
}));

import { useCostData } from '../../hooks/useCostData';

const defaultReturn = {
  summary: null,
  limits: null,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useCostData).mockReturnValue(defaultReturn);
});

describe('MonitorPage', () => {
  it('shows loading state', () => {
    vi.mocked(useCostData).mockReturnValue({ ...defaultReturn, isLoading: true });

    render(<MonitorPage />);

    expect(screen.getByText('Loading cost data...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useCostData).mockReturnValue({ ...defaultReturn, error: 'Connection refused' });

    render(<MonitorPage />);

    expect(screen.getByText('Error: Connection refused')).toBeDefined();
  });

  it('shows cost cards when summary loaded', () => {
    vi.mocked(useCostData).mockReturnValue({
      ...defaultReturn,
      summary: {
        today: { totalCost: 1.5, totalTokens: 1000, requestCount: 5 },
        thisWeek: { totalCost: 3.0, totalTokens: 2000, requestCount: 10 },
        thisMonth: { totalCost: 10.0, totalTokens: 8000, requestCount: 40 },
        allTime: { totalCost: 50.0, totalTokens: 40000, requestCount: 200 },
        byProvider: {},
        byModel: {},
        limits: null,
      },
    });

    render(<MonitorPage />);

    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('$1.50')).toBeDefined();
    expect(screen.getByText('This Week')).toBeDefined();
    expect(screen.getByText('All Time')).toBeDefined();
  });

  it('shows spending bars when limits configured', () => {
    vi.mocked(useCostData).mockReturnValue({
      ...defaultReturn,
      summary: {
        today: { totalCost: 3.5, totalTokens: 1000, requestCount: 5 },
        thisWeek: { totalCost: 3.5, totalTokens: 1000, requestCount: 5 },
        thisMonth: { totalCost: 3.5, totalTokens: 1000, requestCount: 5 },
        allTime: { totalCost: 3.5, totalTokens: 1000, requestCount: 5 },
        byProvider: {},
        byModel: {},
        limits: null,
      },
      limits: {
        maxPerSession: null,
        maxPerDay: { value: 5.0, enforcement: 'block', autoResume: false },
        maxPerWeek: null,
        maxPerMonth: null,
      },
    });

    render(<MonitorPage />);

    expect(screen.getByText('Daily Limit')).toBeDefined();
    expect(screen.getByText('$3.50 / $5.00')).toBeDefined();
  });

  it('shows "no limits" message when no limits configured', () => {
    vi.mocked(useCostData).mockReturnValue({
      ...defaultReturn,
      summary: {
        today: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        thisWeek: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        thisMonth: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        allTime: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        byProvider: {},
        byModel: {},
        limits: null,
      },
      limits: {
        maxPerSession: null,
        maxPerDay: null,
        maxPerWeek: null,
        maxPerMonth: null,
      },
    });

    render(<MonitorPage />);

    expect(screen.getByText('No spending limits configured.')).toBeDefined();
  });

  it('shows provider breakdown when data available', () => {
    vi.mocked(useCostData).mockReturnValue({
      ...defaultReturn,
      summary: {
        today: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        thisWeek: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        thisMonth: { totalCost: 0, totalTokens: 0, requestCount: 0 },
        allTime: { totalCost: 12.34, totalTokens: 25000, requestCount: 100 },
        byProvider: { azure: { totalCost: 7.89, totalTokens: 25000 } },
        byModel: {},
        limits: null,
      },
    });

    render(<MonitorPage />);

    expect(screen.getByText('Cost by Provider')).toBeDefined();
    expect(screen.getByText('azure')).toBeDefined();
    expect(screen.getByText('$7.89')).toBeDefined();
  });
});
