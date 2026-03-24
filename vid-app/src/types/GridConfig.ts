// Grid configuration types for curated column layout

export interface Video {
  id: string;
  title: string;
  filename: string;
  created: string;
  tags?: string[];
  type?: 'file' | 'youtube';
  url?: string;
}

// Grid configuration from YAML file
export interface GridConfig {
  columns: GridColumn[];
}

export interface GridColumn {
  name: string;
  description?: string;
  videos: string[];  // Video identifiers (ID or filename)
}

// Runtime grid state with resolved videos
export interface GridState {
  selectedColumn: number;
  selectedRow: number;
  columns: ResolvedColumn[];
}

export interface ResolvedColumn {
  name: string;
  description?: string;
  videos: Video[];  // Actual matched video objects
}

// For tracking selection position
export interface GridPosition {
  column: number;
  row: number;
}
