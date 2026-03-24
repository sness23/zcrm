import yaml from 'js-yaml';
import type { GridConfig, Video, ResolvedColumn } from '../types/GridConfig';

/**
 * Load and parse grid configuration from YAML
 */
export async function loadGridConfig(): Promise<GridConfig> {
  try {
    const response = await fetch('/vault/videos/grid-layout.yaml');
    if (!response.ok) {
      throw new Error(`Failed to load grid config: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const config = yaml.load(yamlText) as GridConfig;

    console.log('[GridParser] Loaded grid config:', config);
    return config;
  } catch (error) {
    console.error('[GridParser] Error loading grid config:', error);

    // Return default single-column config
    return {
      columns: [
        {
          name: 'All Videos',
          description: 'Default view - no grid-layout.yaml found',
          videos: []
        }
      ]
    };
  }
}

/**
 * Match video identifier to actual video object
 */
export function findVideo(identifier: string, allVideos: Video[]): Video | null {
  // Try by ID first (for YouTube videos)
  let video = allVideos.find(v => v.id === identifier);
  if (video) return video;

  // Try exact filename match
  video = allVideos.find(v => v.filename === identifier);
  if (video) return video;

  // Try filename with .mp4 extension added
  video = allVideos.find(v => v.filename === `${identifier}.mp4`);
  if (video) return video;

  // Try partial filename match (starts with identifier)
  video = allVideos.find(v => v.filename.startsWith(identifier));
  if (video) return video;

  console.warn(`[GridParser] Video not found: ${identifier}`);
  return null;
}

/**
 * Resolve grid configuration by matching identifiers to actual videos
 */
export function resolveGridConfig(config: GridConfig, allVideos: Video[]): ResolvedColumn[] {
  console.log('[GridParser] Resolving grid config with', allVideos.length, 'videos');

  const resolvedColumns: ResolvedColumn[] = config.columns.map(column => {
    const resolvedVideos: Video[] = [];

    for (const identifier of column.videos) {
      const video = findVideo(identifier, allVideos);
      if (video) {
        resolvedVideos.push(video);
      }
    }

    console.log(`[GridParser] Column "${column.name}": ${resolvedVideos.length}/${column.videos.length} videos matched`);

    return {
      name: column.name,
      description: column.description,
      videos: resolvedVideos
    };
  });

  return resolvedColumns;
}
