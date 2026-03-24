import { useState } from 'react';
import type { FileNode } from '../types';

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
  level?: number;
}

function FileTreeNode({ node, onFileSelect, selectedPath, level = 0 }: {
  node: FileNode;
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleClick = () => {
    if (node.type === 'file') {
      onFileSelect(node.path);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const isSelected = node.type === 'file' && selectedPath === node.path;

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="icon">{isExpanded ? '▼' : '▶'}</span>
        )}
        {node.type === 'file' && <span className="icon">📄</span>}
        <span className="name">{node.name}</span>
      </div>
      {node.type === 'directory' && isExpanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ nodes, onFileSelect, selectedPath, level = 0 }: FileTreeProps) {
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          level={level}
        />
      ))}
    </div>
  );
}
