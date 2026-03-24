import React, { useState } from 'react'
import { useGraphStore } from '../stores/graphStore'
import { EntityType } from '../types/graph'
import './GraphControls.css'

const ENTITY_TYPES: EntityType[] = [
  'account', 'contact', 'opportunity', 'lead', 'activity',
  'task', 'quote', 'product', 'campaign', 'event',
  'order', 'contract', 'asset', 'case', 'knowledge'
]

export const GraphControls: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  const {
    filters,
    config,
    isLoading,
    toggleEntityType,
    setSearchQuery,
    toggleClustering,
    togglePhysics,
    toggleLabels,
    setNodeSizing,
    loadGraphData
  } = useGraphStore()

  return (
    <div className={`graph-controls ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="toggle-controls"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Toggle controls"
      >
        {isExpanded ? '◀' : '▶'} Controls
      </button>

      {isExpanded && (
        <div className="controls-content">
          {/* Search */}
          <div className="control-section">
            <h3>Search</h3>
            <input
              type="text"
              placeholder="Search nodes (fuzzy)..."
              value={filters.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Entity Type Filters */}
          <div className="control-section">
            <h3>Entity Types</h3>
            <div className="entity-type-filters">
              {ENTITY_TYPES.map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.entityTypes.has(type)}
                    onChange={() => toggleEntityType(type)}
                  />
                  <span className={`entity-label type-${type}`}>
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="control-section">
            <h3>Display</h3>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.clustering.enabled}
                onChange={toggleClustering}
              />
              <span>Enable Clustering (&gt;1k nodes)</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.physics.enabled}
                onChange={togglePhysics}
              />
              <span>Physics Simulation</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.rendering.showLabels}
                onChange={toggleLabels}
              />
              <span>Show Labels</span>
            </label>

            <div className="radio-group">
              <label>Node Size:</label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="nodeSize"
                  checked={config.rendering.nodeSize === 'uniform'}
                  onChange={() => setNodeSizing('uniform')}
                />
                <span>Uniform</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="nodeSize"
                  checked={config.rendering.nodeSize === 'value'}
                  onChange={() => setNodeSizing('value')}
                />
                <span>By Value</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="nodeSize"
                  checked={config.rendering.nodeSize === 'connections'}
                  onChange={() => setNodeSizing('connections')}
                />
                <span>By Connections</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="control-section">
            <h3>Actions</h3>
            <button
              className="action-button"
              onClick={loadGraphData}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Reload Data'}
            </button>
          </div>

          {/* Stats */}
          <div className="control-section stats">
            <h3>Statistics</h3>
            <GraphStats />
          </div>
        </div>
      )}
    </div>
  )
}

const GraphStats: React.FC = () => {
  const { filteredData, graphData } = useGraphStore()

  if (!graphData) return <div>No data loaded</div>

  return (
    <div className="graph-stats">
      <dl>
        <dt>Total Nodes:</dt>
        <dd>{graphData.nodes.length.toLocaleString()}</dd>

        <dt>Visible Nodes:</dt>
        <dd>{filteredData?.nodes.length.toLocaleString() || 0}</dd>

        <dt>Total Links:</dt>
        <dd>{graphData.links.length.toLocaleString()}</dd>

        <dt>Visible Links:</dt>
        <dd>{filteredData?.links.length.toLocaleString() || 0}</dd>
      </dl>
    </div>
  )
}