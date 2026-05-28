import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewSessionForm } from '../NewSessionForm';

describe('NewSessionForm', () => {
  it('renders inputs and disables Create when repoPath is empty', () => {
    render(<NewSessionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByPlaceholderText(/repository path/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/task/i)).toBeDefined();
    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Create and calls onSubmit with entered values', () => {
    const onSubmit = vi.fn();
    render(<NewSessionForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/repository path/i), { target: { value: 'C:/P' } });
    fireEvent.change(screen.getByPlaceholderText(/name/i), { target: { value: 'My Sess' } });

    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByText('Create'));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'My Sess', repositoryPath: 'C:/P', task: undefined });
  });

  it('does not call onSubmit when repoPath is only whitespace', () => {
    const onSubmit = vi.fn();
    render(<NewSessionForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/repository path/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Create'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<NewSessionForm onSubmit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
