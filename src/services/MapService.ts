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

class MapServiceClass {
  private maps: MapConfigs = {
    "game-map": {
      displayName: "Devground",
      defaultSpawn: {
        x: 0,
        y: 0,
      },
      chunkInfo: {
        startX: -32,
        startY: -64,
      },
    },
    "noob-cave-map": {
      displayName: "Noob Cave",
      defaultSpawn: {
        x: 0,
        y: 0,
      },
      chunkInfo: {
        startX: -16,
        startY: -16,
      },
    },
  };

  private currentMap: string = "game-map";
  private tileSize: number = 32;

  /**
   * Get the configuration for a specific map
   */
  getMap(mapKey: string): MapConfig | null {
    return this.maps[mapKey] || null;
  }

  /**
   * Get all available map keys
   */
  getAllMapKeys(): string[] {
    return Object.keys(this.maps);
  }

  /**
   * Get the display name for a map
   */
  getMapName(mapKey: string): string {
    return this.maps[mapKey]?.displayName || mapKey;
  }

  /**
   * Get the default spawn point for a map in Phaser coordinates
   * Converts the Tiled coordinates to Phaser coordinates
   */
  getDefaultSpawn(mapKey: string): { x: number; y: number } {
    if (!this.maps[mapKey]) {
      console.warn(`No map config found for ${mapKey}, using fallback spawn`);
      return { x: 0, y: 0 };
    }

    // Get the Tiled coordinates for default spawn
    const tiledX = this.maps[mapKey].defaultSpawn.x;
    const tiledY = this.maps[mapKey].defaultSpawn.y;

    // Convert to Phaser coordinates
    return this.tiledToPhaser(mapKey, tiledX, tiledY);
  }

  /**
   * Get the current map key
   */
  getCurrentMap(): string {
    return this.currentMap;
  }

  /**
   * Set the current map
   */
  setCurrentMap(mapKey: string): void {
    if (this.maps[mapKey]) {
      this.currentMap = mapKey;
      eventBus.emit("map.changed", mapKey);
    } else {
      console.error(`Attempted to set invalid map: ${mapKey}`);
    }
  }

  /**
   * Convert Tiled coordinates to Phaser coordinates
   * Tiled coordinates are based on tile indices and may include chunk offsets
   * Phaser coordinates are pixel positions in the world
   */
  tiledToPhaser(mapKey: string, tiledX: number, tiledY: number): { x: number; y: number } {
    try {
      const mapConfig = this.maps[mapKey];
      if (!mapConfig) {
        throw new Error(`Map config not found for ${mapKey}`);
      }

      // Get chunk info or use defaults
      const chunkStartX = mapConfig.chunkInfo?.startX || 0;
      const chunkStartY = mapConfig.chunkInfo?.startY || 0;

      // Calculate pixel position:
      // 1. Adjust tile coordinates relative to chunk origin (tiledX - chunkStartX)
      // 2. Convert to pixels (multiply by tile size)
      // 3. Add half tile size to center in the tile
      const phaserX = (tiledX - chunkStartX) * this.tileSize + this.tileSize / 2;
      const phaserY = (tiledY - chunkStartY) * this.tileSize + this.tileSize / 2;

      console.log(
        `Converting Tiled(${tiledX}, ${tiledY}) to Phaser(${phaserX}, ${phaserY}) for map ${mapKey}`
      );

      return { x: phaserX, y: phaserY };
    } catch (error) {
      console.error("Error in tiledToPhaser conversion:", error);
      // Return a safe fallback
      return { x: 0, y: 0 };
    }
  }

  /**
   * Convert Phaser coordinates to Tiled coordinates
   * Phaser coordinates are pixel positions in the world
   * Tiled coordinates are based on tile indices and may include chunk offsets
   */
  phaserToTiled(mapKey: string, phaserX: number, phaserY: number): { x: number; y: number } {
    try {
      const mapConfig = this.maps[mapKey];
      if (!mapConfig) {
        throw new Error(`Map config not found for ${mapKey}`);
      }

      // Get chunk info or use defaults
      const chunkStartX = mapConfig.chunkInfo?.startX || 0;
      const chunkStartY = mapConfig.chunkInfo?.startY || 0;

      // Calculate tile position:
      // 1. Convert from pixels to tiles (divide by tile size and floor to get tile index)
      // 2. Add chunk offset to get Tiled coordinates
      const tiledX = Math.floor(phaserX / this.tileSize) + chunkStartX;
      const tiledY = Math.floor(phaserY / this.tileSize) + chunkStartY;

      console.log(
        `Converting Phaser(${phaserX}, ${phaserY}) to Tiled(${tiledX}, ${tiledY}) for map ${mapKey}`
      );

      return { x: tiledX, y: tiledY };
    } catch (error) {
      console.error("Error in phaserToTiled conversion:", error);
      // Return a safe fallback
      return { x: 0, y: 0 };
    }
  }

  /**
   * Register a new map config
   */
  registerMap(mapKey: string, config: MapConfig): void {
    this.maps[mapKey] = config;
  }

  /**
   * Set the global tile size
   */
  setTileSize(tileSize: number): void {
    this.tileSize = tileSize;
  }
}

// Create a singleton instance
export const MapService = new MapServiceClass();
