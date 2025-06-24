import { eventBus } from "../utils/EventBus";
import { useGameStore } from "@/stores/gameStore";

export class CursorPositionSystem {
  private scene: Phaser.Scene;
  private tileSize: number = 32;
  private displayElement: HTMLElement | null = null;
  private isEnabled: boolean = true;

  constructor(scene: Phaser.Scene, tileSize: number = 32) {
    this.scene = scene;
    this.tileSize = tileSize;
  }

  async initialize(): Promise<void> {
    try {
      this.createDisplayElement();
      this.setupPointerMoveListener();
    } catch (error) {
      console.error("Error in CursorPositionSystem.initialize:", error);
    }
  }

  private createDisplayElement(): void {
    try {
      // Remove any existing element
      const existingElement = document.getElementById("cursor-position-display");
      if (existingElement) {
        existingElement.remove();
      }

      // Create a simple display element
      this.displayElement = document.createElement("div");
      this.displayElement.id = "cursor-position-display";
      this.displayElement.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        padding: 8px 12px;
        font-family: monospace;
        font-size: 14px;
        font-weight: bold;
        border-radius: 4px;
        z-index: 1000;
        pointer-events: none;
        border: 1px solid #00ff00;
      `;

      document.body.appendChild(this.displayElement);
    } catch (error) {
      console.error("Error in CursorPositionSystem.createDisplayElement:", error);
    }
  }

  private setupPointerMoveListener(): void {
    try {
      this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (!this.isEnabled || !this.displayElement) return;

        // Convert screen position to world position
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Get current map and convert to Tiled tile coordinates
        const store = useGameStore.getState();
        const currentMap = store.currentMap;
        const tiledCoords = this.worldToTiledTile(worldPoint.x, worldPoint.y, currentMap);

        // Update the display
        this.updateDisplay(tiledCoords.x, tiledCoords.y);
      });
    } catch (error) {
      console.error("Error in CursorPositionSystem.setupPointerMoveListener:", error);
    }
  }

  /**
   * Convert world coordinates to Tiled tile coordinates
   */
  private worldToTiledTile(
    worldX: number,
    worldY: number,
    mapKey: string
  ): { x: number; y: number } {
    try {
      // Convert world coordinates to local tile coordinates
      const localTileX = Math.floor(worldX / this.tileSize);
      const localTileY = Math.floor(worldY / this.tileSize);

      // For the game-map, account for chunk offset
      if (mapKey === "game-map") {
        const chunkStartX = -32; // From map JSON data
        const chunkStartY = -64; // From map JSON data

        return {
          x: localTileX + chunkStartX,
          y: localTileY + chunkStartY,
        };
      }

      // For other maps, use direct conversion
      return { x: localTileX, y: localTileY };
    } catch (error) {
      console.error("Error converting world to tiled coordinates:", error);
      return {
        x: Math.floor(worldX / this.tileSize),
        y: Math.floor(worldY / this.tileSize),
      };
    }
  }

  private updateDisplay(tileX: number, tileY: number): void {
    try {
      if (!this.displayElement) return;

      this.displayElement.textContent = `Tile: (${tileX}, ${tileY})`;

      // Emit cursor position event for other systems that might need it
      eventBus.emit("cursor.position.updated", {
        tiledTilePos: { x: tileX, y: tileY },
      });
    } catch (error) {
      console.error("Error in CursorPositionSystem.updateDisplay:", error);
    }
  }

  destroy(): void {
    try {
      this.scene.input.off("pointermove");

      if (this.displayElement) {
        this.displayElement.remove();
        this.displayElement = null;
      }
    } catch (error) {
      console.error("Error in CursorPositionSystem.destroy:", error);
    }
  }
}
