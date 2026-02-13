/**
 * Page Registry — Declare pages by config, not by code.
 * Adding a page = adding a PageConfig entry. Zero code changes.
 */

import type { PageConfig, NavGroup } from './types';

const pages = new Map<string, PageConfig>();

export function registerPage(config: PageConfig): void {
  pages.set(config.id, config);
}

export function getPage(id: string): PageConfig | undefined {
  return pages.get(id);
}

export function getAllPages(): PageConfig[] {
  return Array.from(pages.values());
}

export function getPagesByNavGroup(): NavGroup[] {
  const groups = new Map<string, PageConfig[]>();

  for (const page of pages.values()) {
    const group = page.navGroup || 'other';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(page);
  }

  return Array.from(groups.entries()).map(([id, items]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    items: items
      .sort((a, b) => (a.navOrder ?? 99) - (b.navOrder ?? 99))
      .map(p => ({
        id: p.id,
        label: p.title,
        icon: p.icon,
        route: p.route || `/${p.id}`,
        group: p.navGroup,
        order: p.navOrder,
      })),
  }));
}

export function removePage(id: string): boolean {
  return pages.delete(id);
}
