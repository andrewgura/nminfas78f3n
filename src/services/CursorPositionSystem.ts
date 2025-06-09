import { eventBus } from "../utils/EventBus";

export class CursorPositionSystem {
  private scene: Phaser.Scene;
  private tileSize: number = 32;
  private displayElement: HTMLElement | null = null;
  private isEnabled: boolean = true;
  private trackingEnabled: boolean = false;

  constructor(scene: Phaser.Scene, tileSize: number = 32) {
    this.scene = scene;
    this.tileSize = tileSize;
  }

  async initialize(): Promise<void> {
    try {
      // Create the display element
      this.createDisplayElement();

      // Set up the pointer move listener
      this.setupPointerMoveListener();

      // Default to disabled - user can toggle with key
      this.isEnabled = true;

      console.log("CursorPositionSystem initialized");
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

      // Create a new display element
      this.displayElement = document.createElement("div");
      this.displayElement.id = "cursor-position-display";

      // Create a container for the coordinates
      const coordsContainer = document.createElement("div");
      coordsContainer.className = "coords-container";
      this.displayElement.appendChild(coordsContainer);

      // Enable pointer events for the copy button
      this.displayElement.style.pointerEvents = "auto";

      // Add to document
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

        // Convert world position to tile coordinates
        const tileX = Math.floor(worldPoint.x / this.tileSize);
        const tileY = Math.floor(worldPoint.y / this.tileSize);

        // Update the display
        this.updateDisplay(worldPoint.x, worldPoint.y, tileX, tileY);
      });

      // Start tracking
      this.trackingEnabled = true;
    } catch (error) {
      console.error("Error in CursorPositionSystem.setupPointerMoveListener:", error);
    }
  }

  private updateDisplay(worldX: number, worldY: number, tileX: number, tileY: number): void {
    try {
      if (!this.displayElement) return;

      // Calculate tile center coordinates
      const centerX = tileX * this.tileSize + this.tileSize / 2;
      const centerY = tileY * this.tileSize + this.tileSize / 2;

      // Find or create the coords container
      let coordsContainer = this.displayElement.querySelector(".coords-container");
      if (!coordsContainer) {
        coordsContainer = document.createElement("div");
        coordsContainer.className = "coords-container";
        this.displayElement.prepend(coordsContainer);
      }

      // Clear previous content
      coordsContainer.innerHTML = "";

      // Create and add each line
      const worldLine = document.createElement("div");
      worldLine.textContent = `World: (${Math.round(worldX)}, ${Math.round(worldY)})`;

      const tileLine = document.createElement("div");
      tileLine.textContent = `Tile: (${tileX}, ${tileY})`;

      const centerLine = document.createElement("div");
      centerLine.innerHTML = `<strong>Center: (${centerX}, ${centerY})</strong>`;
      centerLine.style.color = "#ffd700"; // Gold color for emphasis

      // Add all lines to the coords container
      coordsContainer.appendChild(worldLine);
      coordsContainer.appendChild(tileLine);
      coordsContainer.appendChild(centerLine);

      // Emit cursor position event
      eventBus.emit("cursor.position.updated", {
        worldPos: { x: worldX, y: worldY },
        tilePos: { x: tileX, y: tileY },
        centerPos: { x: centerX, y: centerY },
      });
    } catch (error) {
      console.error("Error in CursorPositionSystem.updateDisplay:", error);
    }
  }

  // Show or hide the display element
  toggleVisibility(visible?: boolean): void {
    if (this.displayElement) {
      const newVisibility = visible !== undefined ? visible : !this.isEnabled;
      this.isEnabled = newVisibility;
      this.displayElement.style.display = newVisibility ? "block" : "none";
    }
  }

  destroy(): void {
    try {
      // Remove pointer move event listener if tracking is enabled
      if (this.trackingEnabled) {
        this.scene.input.off("pointermove");
      }

      // Remove the display element
      if (this.displayElement) {
        this.displayElement.remove();
        this.displayElement = null;
      }
    } catch (error) {
      console.error("Error in CursorPositionSystem.destroy:", error);
    }
  }
}
