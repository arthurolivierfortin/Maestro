export type RouteType =
  | 'home'
  | 'foundry'
  | 'foundry-filter'
  | 'foundry-edit'
  | 'canvas'
  | 'workflows'
  | 'models'
  | 'history';

export interface RouteInfo {
  type: RouteType;
  blockId?: string;
  filter?: string;
}

export type BreadcrumbSegmentType = 'home' | 'route' | 'block' | 'action';

export interface BreadcrumbSegment {
  type: BreadcrumbSegmentType;
  label: string;
  path: string;
  blockId?: string;
  blockType?: string;
  isClickable: boolean;
  isCurrent: boolean;
}
 
