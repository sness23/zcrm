import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Entity, EntityType } from '../types/entity.js';

const ENTITY_DIRS: Record<string, string> = {
  account: 'accounts',
  contact: 'contacts',
  opportunity: 'opportunities',
  lead: 'leads',
  activity: 'activities',
  task: 'tasks',
  quote: 'quotes',
  product: 'products',
  campaign: 'campaigns',
  event: 'events',
  order: 'orders',
  contract: 'contracts',
  asset: 'assets',
  case: 'cases',
  knowledge: 'knowledge'
};

export class EntityManager {
  private vaultPath: string;
  private entities: Map<string, Entity> = new Map();

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  // Load all entities
  async loadEntities(): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const [type, dir] of Object.entries(ENTITY_DIRS)) {
      const typeEntities = await this.loadEntitiesOfType(type as EntityType);
      entities.push(...typeEntities);
    }

    return entities;
  }

  // Load entities of specific type
  async loadEntitiesOfType(type: EntityType): Promise<Entity[]> {
    const entities: Entity[] = [];
    const dirName = ENTITY_DIRS[type];

    if (!dirName) {
      return entities;
    }

    const dirPath = path.join(this.vaultPath, dirName);

    if (!fs.existsSync(dirPath)) {
      return entities;
    }

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) {
          continue;
        }

        const filePath = path.join(dirPath, file);
        const entity = this.parseEntityFile(filePath, type);

        if (entity) {
          entities.push(entity);
          this.entities.set(entity.id, entity);
        }
      }
    } catch (error) {
      console.error(`Failed to load entities of type ${type}:`, error);
    }

    return entities;
  }

  // Parse entity file
  private parseEntityFile(filePath: string, type: EntityType): Entity | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(content);
      const { data } = parsed;

      const slug = path.basename(filePath, '.md');

      return {
        id: data.id || '',
        type,
        slug,
        name: data.name || slug,
        metadata: data
      };
    } catch (error) {
      console.error(`Failed to parse entity file ${filePath}:`, error);
      return null;
    }
  }

  // Get entity by ID
  getEntityById(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  // Get entity by slug
  getEntityBySlug(type: EntityType, slug: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.type === type && entity.slug === slug) {
        return entity;
      }
    }
    return undefined;
  }

  // Get all entities of type
  getEntitiesByType(type: EntityType): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.type === type);
  }

  // Get all entities
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  // Search entities
  searchEntities(query: string): Entity[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entities.values()).filter(e => {
      return (
        e.name.toLowerCase().includes(lowerQuery) ||
        e.slug.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(e.metadata).toLowerCase().includes(lowerQuery)
      );
    });
  }

  // Get entity count by type
  getCountByType(): Record<EntityType, number> {
    const counts: any = {};

    for (const type of Object.keys(ENTITY_DIRS)) {
      counts[type] = 0;
    }

    for (const entity of this.entities.values()) {
      counts[entity.type]++;
    }

    return counts;
  }
}
