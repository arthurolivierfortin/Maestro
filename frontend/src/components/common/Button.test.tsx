/**
 * Button Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should render with primary variant by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--primary');
  });

  it('should render with specified variant', () => {
    render(<Button variant="secondary">Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--secondary');
  });

  it('should render with specified size', () => {
    render(<Button size="lg">Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--lg');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    let clicked = false;
    const handleClick = () => {
      clicked = true;
    };

    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole('button');
    await user.click(button);

    expect(clicked).toBe(true);
  });

  it('should be disabled when isLoading is true', () => {
    render(<Button isLoading>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should render loading spinner when isLoading', () => {
    render(<Button isLoading>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--loading');
    expect(button.querySelector('.button__spinner')).toBeInTheDocument();
  });

  it('should render with icon', () => {
    const icon = <span data-testid="icon">★</span>;
    render(<Button icon={icon}>Click me</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render full width when fullWidth is true', () => {
    render(<Button fullWidth>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--full-width');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not call onClick when disabled', async () => {
    const user = userEvent.setup();
    let clicked = false;
    const handleClick = () => {
      clicked = true;
    };

    render(
      <Button disabled onClick={handleClick}>
        Click me
      </Button>
    );
    const button = screen.getByRole('button');
    await user.click(button);

    expect(clicked).toBe(false);
  });
});
