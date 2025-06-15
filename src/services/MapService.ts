// src/services/MapService.ts
import { eventBus } from "@/utils/EventBus";

export interface MapConfig {
  displayName: string;
  defaultSpawn: {
    x: number;
    y: number;
  };
  chunkInfo?: {
    startX: number;
    startY: number;
  };
}

interface MapConfigs {
  [key: string]: MapConfig;
}

interface Coordinates {
  x: number;
  y: number;
}

class MapServiceClass {
  private readonly maps: MapConfigs = {
    "game-map": {
      displayName: "Devground",
      defaultSpawn: { x: 0, y: 0 },
      chunkInfo: { startX: -32, startY: -64 },
    },
    "noob-cave-map": {
      displayName: "Noob Cave",
      defaultSpawn: { x: 0, y: 0 },
      chunkInfo: { startX: -16, startY: -16 },
    },
  };

  private currentMap: string = "game-map";
  private readonly tileSize: number = 32;
  private readonly coordinateCache = new Map<string, Coordinates>();

  /**
   * Get map configuration
   */
  getMap(mapKey: string): MapConfig | null {
    if (!this.isValidMapKey(mapKey)) {
      return null;
    }
    return this.maps[mapKey] || null;
  }

  /**
   * Get all available map keys
   */
  getAllMapKeys(): string[] {
    return Object.keys(this.maps);
  }

  /**
   * Get display name for a map
   */
  getMapName(mapKey: string): string {
    const config = this.getMap(mapKey);
    return config?.displayName || mapKey;
  }

  /**
   * Get default spawn point in Phaser coordinates
   */
  getDefaultSpawn(mapKey: string): Coordinates {
    const config = this.getMap(mapKey);
    if (!config) {
      console.warn(`No map config found for ${mapKey}, using fallback spawn`);
      return { x: 0, y: 0 };
    }

    return this.tiledToPhaser(mapKey, config.defaultSpawn.x, config.defaultSpawn.y);
  }

  /**
   * Get current map key
   */
  getCurrentMap(): string {
    return this.currentMap;
  }

  /**
   * Set current map with validation
   */
  setCurrentMap(mapKey: string): boolean {
    if (!this.isValidMapKey(mapKey)) {
      console.error(`Invalid map key: ${mapKey}`);
      return false;
    }

    if (!this.maps[mapKey]) {
      console.error(`Map configuration not found: ${mapKey}`);
      return false;
    }

    const previousMap = this.currentMap;
    this.currentMap = mapKey;

    // Clear coordinate cache when changing maps
    this.coordinateCache.clear();

    eventBus.emit("map.changed", mapKey);

    return true;
  }

  /**
   * Convert Tiled coordinates to Phaser coordinates with caching
   */
  tiledToPhaser(mapKey: string, tiledX: number, tiledY: number): Coordinates {
    // Create cache key
    const cacheKey = `${mapKey}_${tiledX}_${tiledY}_to_phaser`;
    const cached = this.coordinateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = this.calculateTiledToPhaser(mapKey, tiledX, tiledY);

      // Cache the result
      this.coordinateCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Error in tiledToPhaser conversion:", error);
      return this.getSafeCoordinates();
    }
  }

  /**
   * Convert Phaser coordinates to Tiled coordinates with caching
   */
  phaserToTiled(mapKey: string, phaserX: number, phaserY: number): Coordinates {
    // Create cache key
    const cacheKey = `${mapKey}_${phaserX}_${phaserY}_to_tiled`;
    const cached = this.coordinateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = this.calculatePhaserToTiled(mapKey, phaserX, phaserY);

      // Cache the result
      this.coordinateCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Error in phaserToTiled conversion:", error);
      return this.getSafeCoordinates();
    }
  }

  /**
   * Register a new map configuration
   */
  registerMap(mapKey: string, config: MapConfig): boolean {
    if (!this.isValidMapKey(mapKey)) {
      console.error(`Invalid map key format: ${mapKey}`);
      return false;
    }

    if (!this.validateMapConfig(config)) {
      console.error(`Invalid map configuration for: ${mapKey}`);
      return false;
    }

    this.maps[mapKey] = { ...config };
    eventBus.emit("map.registered", { mapKey, config });
    return true;
  }

  /**
   * Check if coordinates are within map bounds
   */
  isWithinBounds(mapKey: string, tiledX: number, tiledY: number): boolean {
    const config = this.getMap(mapKey);
    if (!config?.chunkInfo) {
      return true; // No bounds checking without chunk info
    }

    // Add bounds validation logic here if needed
    return true;
  }

  /**
   * Get tile size
   */
  getTileSize(): number {
    return this.tileSize;
  }

  /**
   * Clear coordinate cache
   */
  clearCache(): void {
    this.coordinateCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.coordinateCache.size,
      keys: Array.from(this.coordinateCache.keys()),
    };
  }

  // Private helper methods

  private calculateTiledToPhaser(mapKey: string, tiledX: number, tiledY: number): Coordinates {
    const mapConfig = this.maps[mapKey];
    if (!mapConfig) {
      throw new Error(`Map config not found for ${mapKey}`);
    }

    if (!this.isValidCoordinate(tiledX) || !this.isValidCoordinate(tiledY)) {
      throw new Error(`Invalid input coordinates: (${tiledX}, ${tiledY})`);
    }

    const chunkStartX = mapConfig.chunkInfo?.startX || 0;
    const chunkStartY = mapConfig.chunkInfo?.startY || 0;

    const phaserX = (tiledX - chunkStartX) * this.tileSize + this.tileSize / 2;
    const phaserY = (tiledY - chunkStartY) * this.tileSize + this.tileSize / 2;

    return { x: phaserX, y: phaserY };
  }

  private calculatePhaserToTiled(mapKey: string, phaserX: number, phaserY: number): Coordinates {
    const mapConfig = this.maps[mapKey];
    if (!mapConfig) {
      throw new Error(`Map config not found for ${mapKey}`);
    }

    if (!this.isValidCoordinate(phaserX) || !this.isValidCoordinate(phaserY)) {
      throw new Error(`Invalid input coordinates: (${phaserX}, ${phaserY})`);
    }

    const chunkStartX = mapConfig.chunkInfo?.startX || 0;
    const chunkStartY = mapConfig.chunkInfo?.startY || 0;

    const tiledX = Math.floor(phaserX / this.tileSize) + chunkStartX;
    const tiledY = Math.floor(phaserY / this.tileSize) + chunkStartY;

    return { x: tiledX, y: tiledY };
  }

  private isValidMapKey(mapKey: string): boolean {
    return typeof mapKey === "string" && mapKey.length > 0 && /^[a-zA-Z0-9-_]+$/.test(mapKey);
  }

  private isValidCoordinate(coord: number): boolean {
    return typeof coord === "number" && !isNaN(coord) && isFinite(coord);
  }

  private validateMapConfig(config: MapConfig): boolean {
    if (!config || typeof config !== "object") return false;
    if (!config.displayName || typeof config.displayName !== "string") return false;
    if (!config.defaultSpawn || typeof config.defaultSpawn !== "object") return false;
    if (!this.isValidCoordinate(config.defaultSpawn.x)) return false;
    if (!this.isValidCoordinate(config.defaultSpawn.y)) return false;

    if (config.chunkInfo) {
      if (!this.isValidCoordinate(config.chunkInfo.startX)) return false;
      if (!this.isValidCoordinate(config.chunkInfo.startY)) return false;
    }

    return true;
  }

  private getSafeCoordinates(): Coordinates {
    return { x: 0, y: 0 };
  }
}

// Create and export singleton instance
export const MapService = new MapServiceClass();
