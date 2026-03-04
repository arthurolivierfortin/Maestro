/**
 * Panel — Re-exported from @maestro/tui shared components.
 *
 * Cast to FC<any> because the tui Panel has @ts-nocheck and TypeScript
 * infers `children` as required in the props object, but createElement
 * passes children as additional arguments.
 */
import { Panel as _Panel } from '@maestro/tui/components';
import type { FC } from 'react';

export const Panel: FC<any> = _Panel;
