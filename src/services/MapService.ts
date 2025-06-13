import { eventBus } from "../utils/EventBus";

// Map configuration interface
export interface MapConfig {
  mapfile: string;
  mapname: string;
  defaultSpawn: {
    // Using Tiled tile coordinates instead of world coordinates
    tileX: number;
    tileY: number;
  };
  // Chunk information for infinite maps
  chunkInfo?: {
    startX: number; // Starting tile X coordinate of the first chunk
    startY: number; // Starting tile Y coordinate of the first chunk
  };
}

// Internal map configurations
const MAPS: Record<string, MapConfig> = {
  // Main game map
  "game-map": {
    mapfile: "devground",
    mapname: "Starter Town",
    defaultSpawn: {
      // Spawn at Tiled tile (0, 0) instead of world coordinates
      tileX: 0,
      tileY: 0,
    },
    chunkInfo: {
      startX: -32, // From your JSON data
      startY: -64, // From your JSON data
    },
  },

  // Noob cave map
  "noob-cave-map": {
    mapfile: "noob-cave",
    mapname: "Noob Cave",
    defaultSpawn: {
      tileX: 17, // Approximate tile coordinates
      tileY: 17, // Approximate tile coordinates
    },
    chunkInfo: {
      startX: 0,
      startY: 0,
    },
  },
};

class MapServicel {
  private maps: Record<string, MapConfig> = {};
  private currentMap: string = "game-map";
  private tileSize: number = 32;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Load map configurations
      this.maps = { ...MAPS };

      // Emit initialization event
      eventBus.emit("mapService.initialized", {
        mapCount: Object.keys(this.maps).length,
      });
    } catch (error) {
      console.error("Error initializing map service:", error);
    }
  }

  getMap(mapKey: string): MapConfig | null {
    return this.maps[mapKey] || null;
  }

  getAllMapKeys(): string[] {
    return Object.keys(this.maps);
  }

  getMapName(mapKey: string): string {
    return this.maps[mapKey]?.mapname || mapKey;
  }

  getDefaultSpawn(mapKey: string): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map) return { x: 0, y: 0 };

    // Convert Tiled tile coordinates to world coordinates
    return this.tiledTileToWorld(map.defaultSpawn.tileX, map.defaultSpawn.tileY, mapKey);
  }

  /**
   * Convert Tiled tile coordinates to Phaser world coordinates
   */
  tiledTileToWorld(tileX: number, tileY: number, mapKey: string): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map) return { x: tileX * this.tileSize, y: tileY * this.tileSize };

    const chunkInfo = map.chunkInfo || { startX: 0, startY: 0 };

    // Convert Tiled tile coordinates to local tile coordinates
    const localTileX = tileX - chunkInfo.startX;
    const localTileY = tileY - chunkInfo.startY;

    // Convert to world coordinates (tile center)
    return {
      x: localTileX * this.tileSize + this.tileSize / 2,
      y: localTileY * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Convert Phaser world coordinates to Tiled tile coordinates
   */
  worldToTiledTile(worldX: number, worldY: number, mapKey: string): { x: number; y: number } {
    const map = this.maps[mapKey];
    if (!map)
      return { x: Math.floor(worldX / this.tileSize), y: Math.floor(worldY / this.tileSize) };

    const chunkInfo = map.chunkInfo || { startX: 0, startY: 0 };

    // Convert world coordinates to local tile coordinates
    const localTileX = Math.floor(worldX / this.tileSize);
    const localTileY = Math.floor(worldY / this.tileSize);

    // Convert to Tiled tile coordinates
    return {
      x: localTileX + chunkInfo.startX,
      y: localTileY + chunkInfo.startY,
    };
  }

  /**
   * Legacy method - converts between coordinate systems (deprecated)
   * @deprecated Use tiledTileToWorld or worldToTiledTile instead
   */
  tiledToPhaser(mapKey: string, tiledX: number, tiledY: number): { x: number; y: number } {
    console.warn("tiledToPhaser is deprecated. Use tiledTileToWorld instead.");
    return this.tiledTileToWorld(tiledX, tiledY, mapKey);
  }

  /**
   * Legacy method - converts between coordinate systems (deprecated)
   * @deprecated Use tiledTileToWorld or worldToTiledTile instead
   */
  phaserToTiled(mapKey: string, phaserX: number, phaserY: number): { x: number; y: number } {
    console.warn("phaserToTiled is deprecated. Use worldToTiledTile instead.");
    return this.worldToTiledTile(phaserX, phaserY, mapKey);
  }

  setCurrentMap(mapKey: string): void {
    if (this.maps[mapKey]) {
      this.currentMap = mapKey;

      // Emit map changed event
      eventBus.emit("map.changed", mapKey);
    }
  }

  getCurrentMap(): string {
    return this.currentMap;
  }
}

// Create and export singleton instance
export const MapService = new MapServicel();
