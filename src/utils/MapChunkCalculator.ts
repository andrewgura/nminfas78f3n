// src/utils/MapChunkCalculator.ts

/**
 * Development utility for analyzing Tiled maps and calculating optimal chunkInfo values
 * This tool helps determine the correct startX and startY values for new maps
 */
export class MapChunkCalculator {
  /**
   * Calculate optimal chunkInfo based on map bounds
   */
  static calculateChunkInfo(bounds: { minX: number; minY: number; maxX: number; maxY: number }): {
    startX: number;
    startY: number;
  } {
    return {
      startX: bounds.minX,
      startY: bounds.minY,
    };
  }

  /**
   * Extract coordinate bounds from Tiled map data
   */
  static extractBoundsFromTiledMap(tiledMapData: any): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    const hasChunks = tiledMapData.infinite === true;

    if (hasChunks) {
      // Process infinite maps with chunks
      this.processChunkedLayers(tiledMapData, (bounds) => {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });
    } else {
      // Process finite maps
      minX = 0;
      minY = 0;
      maxX = tiledMapData.width - 1;
      maxY = tiledMapData.height - 1;

      // Still check object layers for extended bounds
      this.processObjectLayers(tiledMapData, (bounds) => {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Analyze a loaded map and suggest configuration
   */
  static analyzeTiledMap(mapKey: string, scene: Phaser.Scene) {
    try {
      const map = scene.cache.tilemap.get(mapKey);
      if (!map?.data) {
        console.error(`Map ${mapKey} not found in cache`);
        return undefined;
      }

      const bounds = this.extractBoundsFromTiledMap(map.data);
      const chunkInfo = this.calculateChunkInfo(bounds);

      return { bounds, chunkInfo };
    } catch (error) {
      console.error(`Error analyzing map ${mapKey}:`, error);
      return undefined;
    }
  }

  /**
   * Process chunked layers in infinite maps
   */
  private static processChunkedLayers(tiledMapData: any, callback: (bounds: any) => void): void {
    tiledMapData.layers.forEach((layer: any) => {
      if (layer.chunks) {
        layer.chunks.forEach((chunk: any) => {
          callback({
            minX: chunk.x,
            minY: chunk.y,
            maxX: chunk.x + chunk.width - 1,
            maxY: chunk.y + chunk.height - 1,
          });
        });
      }
    });
  }

  /**
   * Process object layers for coordinate bounds
   */
  private static processObjectLayers(tiledMapData: any, callback: (bounds: any) => void): void {
    tiledMapData.layers.forEach((layer: any) => {
      if (layer.objects?.length > 0) {
        layer.objects.forEach((obj: any) => {
          const tileX = Math.floor(obj.x / tiledMapData.tilewidth);
          const tileY = Math.floor(obj.y / tiledMapData.tileheight);

          let endTileX = tileX;
          let endTileY = tileY;

          if (obj.width && obj.height) {
            endTileX = Math.ceil((obj.x + obj.width) / tiledMapData.tilewidth) - 1;
            endTileY = Math.ceil((obj.y + obj.height) / tiledMapData.tileheight) - 1;
          }

          callback({
            minX: tileX,
            minY: tileY,
            maxX: endTileX,
            maxY: endTileY,
          });
        });
      }
    });
  }

  /**
   * Development helper: Analyze map from browser console
   */
  static createConsoleHelper(): void {
    if (process.env.NODE_ENV === "development") {
      (window as any).analyzeMap = (mapKey: string) => {
        const scene = (window as any).game?.scene?.getScene("game");
        if (scene) {
          return MapChunkCalculator.analyzeTiledMap(mapKey, scene);
        } else {
          console.error("❌ Game scene not found");
          return null;
        }
      };
    }
  }
}

// Auto-create console helper in development
MapChunkCalculator.createConsoleHelper();
