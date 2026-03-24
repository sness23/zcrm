import React from 'react'
import { useGraphStore } from '../stores/graphStore'
import './NodeDetailPanel.css'

export const NodeDetailPanel: React.FC = () => {
  const { selectedNode, selectNode } = useGraphStore()

  if (!selectedNode) {
    return null
  }

  return (
    <div className="node-detail-panel">
      <div className="node-detail-header">
        <h2>{selectedNode.name}</h2>
        <button
          className="close-button"
          onClick={() => selectNode(null)}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="node-detail-content">
        <div className="detail-section">
          <h3>Basic Information</h3>
          <dl>
            <dt>ID:</dt>
            <dd>{selectedNode.id}</dd>

            <dt>Type:</dt>
            <dd className={`entity-type type-${selectedNode.type}`}>
              {selectedNode.type}
            </dd>

            {selectedNode.stats.value && (
              <>
                <dt>Value:</dt>
                <dd>${selectedNode.stats.value.toLocaleString()}</dd>
              </>
            )}

            <dt>Connections:</dt>
            <dd>{selectedNode.stats.totalConnections}</dd>

            {selectedNode.stats.created && (
              <>
                <dt>Created:</dt>
                <dd>{new Date(selectedNode.stats.created).toLocaleDateString()}</dd>
              </>
            )}

            {selectedNode.stats.modified && (
              <>
                <dt>Modified:</dt>
                <dd>{new Date(selectedNode.stats.modified).toLocaleDateString()}</dd>
              </>
            )}
          </dl>
        </div>

        {Object.keys(selectedNode.frontmatter).length > 0 && (
          <div className="detail-section">
            <h3>Properties</h3>
            <dl>
              {Object.entries(selectedNode.frontmatter)
                .filter(([key]) => !['id', 'name', 'type'].includes(key))
                .map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt>{key.replace(/_/g, ' ')}:</dt>
                    <dd>
                      {typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </dd>
                  </React.Fragment>
                ))}
            </dl>
          </div>
        )}

        <div className="detail-section">
          <h3>Relationships</h3>

          {selectedNode.links.incoming.length > 0 && (
            <div className="relationship-list">
              <h4>Incoming ({selectedNode.links.incoming.length})</h4>
              <ul>
                {selectedNode.links.incoming.slice(0, 10).map((link, idx) => (
                  <li key={idx}>
                    <span className="link-source">{link.source}</span>
                    {link.type && <span className="link-type">{link.type}</span>}
                  </li>
                ))}
                {selectedNode.links.incoming.length > 10 && (
                  <li className="more-items">
                    +{selectedNode.links.incoming.length - 10} more...
                  </li>
                )}
              </ul>
            </div>
          )}

          {selectedNode.links.outgoing.length > 0 && (
            <div className="relationship-list">
              <h4>Outgoing ({selectedNode.links.outgoing.length})</h4>
              <ul>
                {selectedNode.links.outgoing.slice(0, 10).map((link, idx) => (
                  <li key={idx}>
                    {link.type && <span className="link-type">{link.type}</span>}
                    <span className="link-target">{link.target}</span>
                  </li>
                ))}
                {selectedNode.links.outgoing.length > 10 && (
                  <li className="more-items">
                    +{selectedNode.links.outgoing.length - 10} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {selectedNode.body && (
          <div className="detail-section">
            <h3>Notes</h3>
            <div className="node-body">
              {selectedNode.body}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}