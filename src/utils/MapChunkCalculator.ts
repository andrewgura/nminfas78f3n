// src/utils/MapChunkCalculator.ts
import { eventBus } from "@/utils/EventBus";

/**
 * Map Chunk Calculator
 *
 * A utility to help determine the correct chunkInfo values for maps
 * based on their coordinate bounds in Tiled.
 */
export class MapChunkCalculator {
  /**
   * Calculate the chunk info for a Tiled map based on its bounds
   *
   * @param bounds The bounds of the map in Tiled coordinates
   * @returns The chunkInfo object with startX and startY values
   */
  static calculateChunkInfo(bounds: { minX: number; minY: number; maxX: number; maxY: number }): {
    startX: number;
    startY: number;
  } {
    // The startX and startY values should be the negative of the minimum X and Y
    // This ensures that (minX, minY) in Tiled becomes (0, 0) in Phaser world coordinates
    return {
      startX: bounds.minX,
      startY: bounds.minY,
    };
  }

  /**
   * Extract bounds from a Tiled map JSON
   *
   * @param tiledMapData The Tiled map JSON data
   * @returns The bounds of the map in Tiled coordinates
   */
  static extractBoundsFromTiledMap(tiledMapData: any): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    try {
      // Initialize bounds to extreme values
      let minX = Number.MAX_SAFE_INTEGER;
      let minY = Number.MAX_SAFE_INTEGER;
      let maxX = Number.MIN_SAFE_INTEGER;
      let maxY = Number.MIN_SAFE_INTEGER;

      // Check if the map has chunks (infinite map)
      const hasChunks = tiledMapData.infinite === true;

      if (hasChunks) {
        // Process each layer
        tiledMapData.layers.forEach((layer: any) => {
          if (layer.chunks) {
            // Process each chunk
            layer.chunks.forEach((chunk: any) => {
              // Update bounds based on chunk position
              minX = Math.min(minX, chunk.x);
              minY = Math.min(minY, chunk.y);
              maxX = Math.max(maxX, chunk.x + chunk.width - 1);
              maxY = Math.max(maxY, chunk.y + chunk.height - 1);
            });
          }
        });
      } else {
        // For finite maps, bounds are simpler
        minX = 0;
        minY = 0;
        maxX = tiledMapData.width - 1;
        maxY = tiledMapData.height - 1;

        // But we still need to check object layers
        tiledMapData.layers.forEach((layer: any) => {
          if (layer.objects && layer.objects.length > 0) {
            layer.objects.forEach((obj: any) => {
              // Convert pixel coordinates to tile coordinates
              const tileX = Math.floor(obj.x / tiledMapData.tilewidth);
              const tileY = Math.floor(obj.y / tiledMapData.tileheight);

              // Update bounds
              minX = Math.min(minX, tileX);
              minY = Math.min(minY, tileY);

              // Consider object width/height if available
              if (obj.width && obj.height) {
                const endTileX = Math.ceil((obj.x + obj.width) / tiledMapData.tilewidth) - 1;
                const endTileY = Math.ceil((obj.y + obj.height) / tiledMapData.tileheight) - 1;
                maxX = Math.max(maxX, endTileX);
                maxY = Math.max(maxY, endTileY);
              } else {
                maxX = Math.max(maxX, tileX);
                maxY = Math.max(maxY, tileY);
              }
            });
          }
        });
      }

      return { minX, minY, maxX, maxY };
    } catch (error) {
      console.error("Error extracting bounds from Tiled map:", error);
      // Return default bounds
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
  }

  /**
   * Utility method to analyze a loaded Tiled map and suggest chunk info
   * This can be called during development to determine appropriate chunkInfo values
   *
   * @param mapKey The key of the loaded map
   * @param scene The Phaser scene containing the map
   * @returns Analysis results including bounds and suggested chunkInfo
   */
  static analyzeTiledMap(
    mapKey: string,
    scene: Phaser.Scene
  ):
    | {
        bounds: { minX: number; minY: number; maxX: number; maxY: number };
        chunkInfo: { startX: number; startY: number };
      }
    | undefined {
    try {
      const map = scene.cache.tilemap.get(mapKey);
      if (!map || !map.data) {
        console.error(`Map ${mapKey} not found in cache`);
        return undefined;
      }

      // Extract bounds from the map data
      const bounds = this.extractBoundsFromTiledMap(map.data);

      // Calculate chunk info
      const chunkInfo = this.calculateChunkInfo(bounds);

      // Log results
      console.log(`=== Map Chunk Analysis for ${mapKey} ===`);
      console.log(
        `Map bounds in Tiled: (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`
      );
      console.log(
        `Suggested chunkInfo: { startX: ${chunkInfo.startX}, startY: ${chunkInfo.startY} }`
      );
      console.log(`Add this to your MapService configuration for ${mapKey}`);

      // Return the results for use in code
      return { bounds, chunkInfo };
    } catch (error) {
      console.error(`Error analyzing map ${mapKey}:`, error);
      return undefined;
    }
  }
}

// Export a function to analyze maps from the console during development
(window as any).analyzeMap = (mapKey: string) => {
  const scene = (window as any).game.scene.getScene("game");
  if (scene) {
    return MapChunkCalculator.analyzeTiledMap(mapKey, scene);
  } else {
    console.error("Game scene not found");
    return null;
  }
};
