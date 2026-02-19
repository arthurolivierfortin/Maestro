// @ts-nocheck
/**
 * Filesystem Component (Ink) — With expand/collapse tree navigation.
 *
 * Displays the project directory tree with access permissions.
 * Data-first approach: buildDirectoryTree produces tree data,
 * flattenFilesystem converts to FlatNode[] for treeNav.
 *
 * When treeNav is provided: interactive with cursor + expand/collapse.
 * When treeNav is null: backward-compatible fully-expanded render.
 *
 * Props: { session, context, treeNav }
 */

import { createElement as h, useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import fs from 'fs';
import path from 'path';
import {
  T, primary, secondary, muted, dim, error,
  icons, theme,
} from '../theme.ts';

// ── Constants ───────────────────────────────────────────────────

const MAX_DEPTH = 3;
const MAX_ITEMS = 15;
const IGNORE_LIST = ['node_modules', '.git', '__pycache__', '.vs', 'bin', 'obj', 'dist', 'build'];

// ── Helpers ─────────────────────────────────────────────────────

const isDirectory = (itemPath) => {
  try {
    return fs.statSync(itemPath).isDirectory();
  } catch {
    return false;
  }
};

const shouldIgnore = (name) => IGNORE_LIST.includes(name);

const getAccess = (itemPath) => {
  const name = path.basename(itemPath);
  const ext = path.extname(itemPath);

  if (shouldIgnore(name)) return 'none';

  if (['.ts', '.js', '.tsx', '.jsx', '.cs', '.py', '.go', '.rs'].includes(ext)) return 'rw';
  if (name.includes('.test.') || name.includes('.spec.') || name.includes('_test.')) return 'r';
  if (['.json', '.yaml', '.yml', '.toml', '.xml', '.config'].includes(ext)) return 'r';
  if (itemPath.includes('src') || itemPath.includes('lib')) return 'rw';
  if (itemPath.includes('test') || itemPath.includes('spec')) return 'r';

  return 'r';
};

const getAccessColor = (access) => {
  const colorMap = { 'rw': 'green', 'r': 'yellow', 'none': 'red', 'active': 'cyan' };
  return colorMap[access] || 'yellow';
};

const formatAccessLabel = (access) => {
  const labels = { 'rw': '[rw]', 'r': '[r-]', 'none': '[--]' };
  return labels[access] || '[r-]';
};

// ── Data-first tree building ─────────────────────────────────────

/**
 * Builds a directory tree data structure from the filesystem.
 * Returns array of { id, name, fullPath, isDir, access, ignored, children }
 */
const buildDirectoryTree = (dirPath, depth = 0) => {
  const result = [];

  if (depth >= MAX_DEPTH) return result;

  let items = [];
  try {
    items = fs.readdirSync(dirPath);
  } catch {
    return result;
  }

  // Sort: directories first, then alphabetically
  items.sort((a, b) => {
    const aPath = path.join(dirPath, a);
    const bPath = path.join(dirPath, b);
    const aIsDir = isDirectory(aPath);
    const bIsDir = isDirectory(bPath);
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  const displayItems = items.slice(0, MAX_ITEMS);
  const hasMore = items.length > MAX_ITEMS;

  for (const item of displayItems) {
    const itemPath = path.join(dirPath, item);
    const isDir = isDirectory(itemPath);
    const ignored = shouldIgnore(item);
    const access = getAccess(itemPath);
    const id = itemPath.replace(/\\/g, '/');

    const node = { id, name: item, fullPath: itemPath, isDir, access, ignored, children: [] };

    if (isDir && !ignored) {
      node.children = buildDirectoryTree(itemPath, depth + 1);
    }

    result.push(node);
  }

  if (hasMore) {
    result.push({
      id: dirPath + '/__more__',
      name: `... ${items.length - MAX_ITEMS} more`,
      fullPath: null,
      isDir: false,
      access: 'none',
      ignored: true,
      children: [],
    });
  }

  return result;
};

/**
 * Flattens filesystem tree into FlatNode[] respecting expanded set.
 */
const flattenFilesystem = (treeNodes, expandedSet, depth = 0, parentId = null) => {
  const result = [];

  for (const node of treeNodes) {
    const hasChildren = node.isDir && node.children.length > 0;
    const isExpanded = expandedSet.has(node.id);

    result.push({
      id: node.id,
      depth,
      hasChildren,
      isExpanded,
      parentId,
      label: node.isDir ? node.name + '/' : node.name,
      data: node,
    });

    if (hasChildren && isExpanded) {
      result.push(...flattenFilesystem(node.children, expandedSet, depth + 1, node.id));
    }
  }

  return result;
};

// ── FlatFileRow ──────────────────────────────────────────────────

const FlatFileRow = ({ node, isSelected, depth }) => {
  const data = node.data;
  const ignored = data.ignored;
  const color = ignored ? 'gray' : getAccessColor(data.access);
  const accessLabel = ignored ? '[--]' : formatAccessLabel(data.access);

  const indent = '  '.repeat(depth);

  let expandIcon = '  ';
  if (node.hasChildren) {
    expandIcon = node.isExpanded ? icons.expanded + ' ' : icons.collapsed + ' ';
  }

  const parts = [];

  // Cursor
  if (isSelected) {
    parts.push(h(Text, { key: 'cur', color: theme.tree.cursor }, '> '));
  } else {
    parts.push(h(Text, { key: 'cur' }, '  '));
  }

  // Indent
  parts.push(h(Text, { key: 'indent' }, indent));

  // Expand icon
  if (node.hasChildren) {
    parts.push(h(Text, { key: 'exp', color: theme.tree.expandIcon }, expandIcon));
  } else {
    parts.push(h(Text, { key: 'exp' }, expandIcon));
  }

  // Name
  const nameColor = isSelected ? theme.tree.cursor : color;
  const nameBold = isSelected && theme.tree.selectedBold;
  parts.push(h(Text, { key: 'name', color: nameColor, bold: nameBold }, node.label));

  // Access label
  parts.push(h(Text, { key: 'sp' }, '  '));
  parts.push(h(Text, { key: 'access', color: ignored ? 'gray' : color }, accessLabel));

  // Trailing clear: overwrite leftover chars from previous renders
  parts.push(h(Text, { key: 'clr' }, '     '));

  return h(Box, { flexDirection: 'row' }, ...parts);
};

// ── Legacy tree item (when treeNav is null) ────────────────────

const TreeItem = ({ prefix, name, isDir, access, ignored }) => {
  const color = ignored ? 'gray' : getAccessColor(access);
  const displayName = isDir ? name + '/' : name;
  const accessLabel = ignored ? '[--]' : formatAccessLabel(access);
  const accessColor = ignored ? 'gray' : color;

  return h(Box, { flexDirection: 'row' },
    dim(prefix + ' '),
    T(color, displayName),
    h(Text, null, '  '),
    T(accessColor, accessLabel)
  );
};

const renderDirectoryItems = (dirPath, accessRules, indentStr, depth) => {
  const elements = [];

  if (depth >= MAX_DEPTH) {
    elements.push(
      h(Box, { key: 'ellipsis-' + depth + '-' + dirPath, flexDirection: 'row' },
        dim(indentStr + '...')
      )
    );
    return elements;
  }

  let items = [];
  try {
    items = fs.readdirSync(dirPath);
  } catch {
    elements.push(
      h(Box, { key: 'denied-' + dirPath, flexDirection: 'row' },
        error(indentStr + '(access denied)')
      )
    );
    return elements;
  }

  items.sort((a, b) => {
    const aPath = path.join(dirPath, a);
    const bPath = path.join(dirPath, b);
    const aIsDir = isDirectory(aPath);
    const bIsDir = isDirectory(bPath);
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  const displayItems = items.slice(0, MAX_ITEMS);
  const hasMore = items.length > MAX_ITEMS;

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i];
    const itemPath = path.join(dirPath, item);
    const isLast = i === displayItems.length - 1 && !hasMore;
    const prefix = isLast ? icons.lastBranch : icons.branch;
    const isDir = isDirectory(itemPath);
    const ignored = shouldIgnore(item);
    const access = getAccess(itemPath);

    elements.push(
      h(TreeItem, {
        key: 'item-' + depth + '-' + item,
        prefix: indentStr + prefix,
        name: item,
        isDir,
        access,
        ignored,
      })
    );

    if (ignored) continue;

    if (isDir) {
      const childIndent = indentStr + (isLast ? '    ' : icons.vertical + '   ');
      const childElements = renderDirectoryItems(itemPath, accessRules, childIndent, depth + 1);
      elements.push(...childElements);
    }
  }

  if (hasMore) {
    const morePrefix = indentStr + icons.lastBranch;
    elements.push(
      h(Box, { key: 'more-' + depth + '-' + dirPath, flexDirection: 'row' },
        dim(morePrefix + ' ... ' + (items.length - MAX_ITEMS) + ' more')
      )
    );
  }

  return elements;
};

// ── Main component ──────────────────────────────────────────────

const Filesystem = ({ session, context, treeNav = null }) => {
  const workingDir = session?.workingDirectory || context?.workingDirectory;
  const hasWorkingDir = workingDir && workingDir !== '.' && workingDir !== 'N/A';

  // Destructure stable refs from treeNav
  const tnExpanded = treeNav?.expanded;
  const tnExpand = treeNav?.expand;
  const tnSetFlatNodes = treeNav?.setFlatNodes;

  // IMPORTANT: All hooks must be called unconditionally (React rules of hooks).
  // Build tree data from filesystem
  const treeData = useMemo(() => {
    if (!hasWorkingDir || !tnExpanded) return [];
    try {
      if (!fs.existsSync(workingDir)) return [];
      return buildDirectoryTree(workingDir);
    } catch {
      return [];
    }
  }, [workingDir, hasWorkingDir, tnExpanded]);

  // Default expand: top-level directories
  useEffect(() => {
    if (!tnExpand || !tnExpanded || treeData.length === 0) return;
    for (const node of treeData) {
      if (node.isDir && !node.ignored && !tnExpanded.has(node.id)) {
        tnExpand(node.id);
      }
    }
  }, [treeData, tnExpanded, tnExpand]);

  // Flatten filesystem tree
  const flatNodes = useMemo(() => {
    if (!tnExpanded || treeData.length === 0) return [];
    return flattenFilesystem(treeData, tnExpanded);
  }, [treeData, tnExpanded]);

  // Report flat nodes to treeNav
  useEffect(() => {
    if (!tnSetFlatNodes) return;
    tnSetFlatNodes(flatNodes);
  }, [flatNodes, tnSetFlatNodes]);

  // Early return AFTER all hooks
  if (!hasWorkingDir) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      dim('(no working directory bound)'),
      h(Box, { height: 1 }),
      dim('bind with project path')
    );
  }

  // Interactive mode with treeNav
  if (treeNav) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      h(Box, { key: 'dir-path', paddingLeft: 2 }, secondary(workingDir)),
      ...flatNodes.map((fNode, i) =>
        h(FlatFileRow, {
          key: fNode.id,
          node: fNode,
          isSelected: i === treeNav.cursor,
          depth: fNode.depth,
        })
      )
    );
  }

  // Legacy mode (no treeNav)
  const children = [
    h(Box, { key: 'dir-path', paddingLeft: 2 }, secondary(workingDir)),
  ];

  try {
    if (fs.existsSync(workingDir)) {
      const treeElements = renderDirectoryItems(workingDir, context?.accessRules || {}, '  ', 0);
      children.push(...treeElements);
    } else {
      children.push(
        h(Box, { key: 'not-found', paddingLeft: 2 },
          dim('(directory not found)')
        )
      );
    }
  } catch (err) {
    children.push(
      h(Box, { key: 'error', paddingLeft: 2 },
        error('error: ' + err.message)
      )
    );
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...children);
};

export { Filesystem, buildDirectoryTree, flattenFilesystem };
