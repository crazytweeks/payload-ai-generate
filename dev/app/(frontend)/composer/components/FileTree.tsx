'use client';

import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import { useState } from 'react';

type TreeNode = {
  children: Record<string, TreeNode>;
  isFile: boolean;
  name: string;
};

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { children: {}, isFile: false, name: '' };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (!node.children[part]) {
        node.children[part] = { children: {}, isFile: i === parts.length - 1, name: part };
      }
      node = node.children[part]!;
    }
  }
  return root;
}

function TreeNodeView({
  activeFile,
  depth,
  node,
  onSelect,
  path,
}: {
  activeFile: string | undefined;
  depth: number;
  node: TreeNode;
  onSelect: (path: string) => void;
  path: string;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Object.keys(node.children).length > 0;

  if (node.isFile) {
    const isActive = path === activeFile;
    return (
      <button
        type="button"
        onClick={() => onSelect(path)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={[
          'flex w-full items-center gap-1.5 py-0.5 text-left text-[11px] font-mono hover:text-zinc-200',
          isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500',
        ].join(' ')}
      >
        <File size={11} className="shrink-0 text-zinc-600" />
        {node.name}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex w-full items-center gap-1.5 py-0.5 text-left text-[11px] font-mono text-zinc-500 hover:text-zinc-300"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Folder size={11} className="shrink-0 text-violet-600" />
        {node.name}
      </button>
      {open &&
        hasChildren &&
        Object.entries(node.children)
          .sort(([, a], [, b]) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
            return a.name.localeCompare(b.name);
          })
          .map(([key, child]) => (
            <TreeNodeView
              key={key}
              activeFile={activeFile}
              depth={depth + 1}
              node={child}
              onSelect={onSelect}
              path={path ? `${path}/${key}` : key}
            />
          ))}
    </div>
  );
}

export function FileTree({
  activeFile,
  files,
  onSelect,
}: {
  activeFile: string | undefined;
  files: string[];
  onSelect: (path: string) => void;
}) {
  const tree = buildTree(files);

  return (
    <div className="h-full overflow-y-auto py-2">
      {Object.entries(tree.children)
        .sort(([, a], [, b]) => {
          if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
          return a.name.localeCompare(b.name);
        })
        .map(([key, child]) => (
          <TreeNodeView
            key={key}
            activeFile={activeFile}
            depth={0}
            node={child}
            onSelect={onSelect}
            path={key}
          />
        ))}
    </div>
  );
}
