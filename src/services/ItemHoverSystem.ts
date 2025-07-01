import { eventBus } from "../utils/EventBus";
import { throttle } from "../utils/FunctionUtils";
import { useGameStore } from "../stores/gameStore";
import { Item } from "../entities/Item";

export class ItemHoverSystem {
  public currentHoveredItem: Item | null = null;
  private currentScene: Phaser.Scene | null = null;
  private lastPointerPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly minPointerMoveDistance: number = 3;
  private handlePointerMove: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private handleCanvasLeave: (() => void) | null = null;
  private isInitialized: boolean = false;
  private registeredScenes: Set<string> = new Set();

  constructor() {
    this.initialize().catch((err) => console.error("Error initializing ItemHoverSystem:", err));

    // Throttle the checkAllItemsForHover method
    this.checkAllItemsForHover = throttle(this.checkAllItemsForHover.bind(this), 100);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Wait for game scene to be ready
      await this.waitForGameScene();

      // Set up periodic cleanup for orphaned hover effects
      this.setupOrphanedGlowCleanup();

      this.isInitialized = true;

      // Subscribe to scene changes to update listeners
      eventBus.on("scene.switched", this.handleSceneChange.bind(this));
      eventBus.on("game.scene.ready", this.handleSceneReady.bind(this));
    } catch (error) {
      console.error("Error in ItemHoverSystem.initialize:", error);
    }
  }

  private handleSceneChange(scene: Phaser.Scene): void {
    // Don't auto-setup during map transitions - let GameScene handle it manually
    return;
  }

  private handleSceneReady(): void {
    // Get the current scene from the PhaserSceneManager
    const systems = useGameStore.getState().systems || {};
    const gameScene = systems.gameScene;

    if (gameScene && !this.registeredScenes.has(gameScene.scene.key)) {
      this.setupGlobalPointerHandler(gameScene);
      this.registeredScenes.add(gameScene.scene.key);
    }
  }

  private async waitForGameScene(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const systems = useGameStore.getState().systems || {};
        if (systems.gameScene) {
          clearInterval(checkInterval);
          this.setupGlobalPointerHandler(systems.gameScene);
          resolve();
          return;
        }
      }, 500);

      // Set a timeout to avoid infinite waiting
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn("Timeout waiting for game scene in ItemHoverSystem");
        resolve();
      }, 10000);
    });
  }

  public setupGlobalPointerHandler(scene: Phaser.Scene): void {
    // Clean up existing
    this.cleanup();
    this.currentScene = scene;

    // Create new handler
    this.handlePointerMove = (pointer: Phaser.Input.Pointer) => {
      if (useGameStore.getState().inputFocused) return;

      // Check distance
      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.lastPointerPosition.x,
        this.lastPointerPosition.y
      );

      if (dist < this.minPointerMoveDistance) return;

      this.lastPointerPosition.x = pointer.x;
      this.lastPointerPosition.y = pointer.y;

      if (this.currentScene) {
        this.checkAllItemsForHover(this.currentScene, pointer);
      }
    };

    // Register listener
    if (scene.input) {
      scene.input.on("pointermove", this.handlePointerMove);
    }

    // Setup canvas leave handler
    const canvas = document.querySelector("canvas");
    if (canvas) {
      this.handleCanvasLeave = () => {
        if (this.currentHoveredItem) {
          this.clearHoverState();
        }
      };
      canvas.addEventListener("mouseleave", this.handleCanvasLeave);
    }

    // Clear and re-register this scene
    this.registeredScenes.clear();
    this.registeredScenes.add(scene.scene.key);
  }

  private checkAllItemsForHover(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): void {
    interface GameSceneWithItems extends Phaser.Scene {
      items?: Phaser.GameObjects.Group;
    }

    const gameScene = scene as GameSceneWithItems;
    if (!gameScene?.items) return;

    const items = gameScene.items.getChildren() as Item[];

    if (items.length === 0) {
      if (this.currentHoveredItem) {
        this.clearHoverState();
      }
      return;
    }

    const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hoverRadius = 40;
    let closestItem: Item | null = null;
    let closestDistance = Number.MAX_VALUE;

    for (const item of items) {
      if (!item.active) continue;

      const dx = item.x - worldPoint.x;
      const dy = item.y - worldPoint.y;
      const distSquared = dx * dx + dy * dy;

      if (distSquared < hoverRadius * hoverRadius && distSquared < closestDistance) {
        closestItem = item;
        closestDistance = distSquared;
      }
    }

    // Clear current hover if nothing found
    if (!closestItem && this.currentHoveredItem) {
      this.clearHoverState();
      return;
    }

    // If we found a new item to hover
    if (closestItem && closestItem !== this.currentHoveredItem) {
      // Clear previous hover state if different item
      if (this.currentHoveredItem) {
        this.clearHoverState();
      }

      this.currentHoveredItem = closestItem;

      // Add visual hover effect in the game world
      if (typeof closestItem.applyGlowEffect === "function") {
        closestItem.applyGlowEffect();
      }

      // Get item instance data - INCLUDE THE QUANTITY!
      const itemInstance = {
        templateId: closestItem.templateId,
        instanceId: closestItem.instanceId,
        bonusStats: closestItem.bonusStats,
        quantity: closestItem.quantity, // THIS WAS MISSING!
      };

      // Emit event for React tooltip component to display
      eventBus.emit("item.world.tooltip.show", {
        itemInstance,
      });

      // Emit hover start event
      eventBus.emit("item.hover.start", {
        id: closestItem.instanceId,
        templateId: closestItem.templateId,
        name: closestItem.name,
      });
    }
  }

  private clearHoverState(): void {
    if (!this.currentHoveredItem) return;

    // Clear visual effects
    if (typeof this.currentHoveredItem.removeGlowEffect === "function") {
      this.currentHoveredItem.removeGlowEffect();
    }

    // Emit event to hide the tooltip
    eventBus.emit("item.world.tooltip.hide");

    // Emit hover end event
    eventBus.emit("item.hover.end", {
      id: this.currentHoveredItem.instanceId,
    });

    this.currentHoveredItem = null;
  }

  private setupOrphanedGlowCleanup(): void {
    setInterval(() => this.cleanupOrphanedGlowEffects(), 5000);
  }

  private cleanupOrphanedGlowEffects(): void {
    if (
      this.currentHoveredItem &&
      (!this.currentHoveredItem.active || !this.currentHoveredItem.scene)
    ) {
      this.clearHoverState();
    }
  }

  cleanup(): void {
    this.clearHoverState();

    // Clean up current scene event listeners
    if (this.currentScene && this.handlePointerMove) {
      try {
        this.currentScene.input?.off("pointermove", this.handlePointerMove);
      } catch (error) {
        console.error("Error cleaning up current scene listener:", error);
      }
    }

    // Clean up canvas event listener
    const canvas = document.querySelector("canvas");
    if (canvas && this.handleCanvasLeave) {
      canvas.removeEventListener("mouseleave", this.handleCanvasLeave);
    }

    // Unsubscribe from events
    eventBus.off("scene.switched", this.handleSceneChange);
    eventBus.off("game.scene.ready", this.handleSceneReady);

    // Reset handlers and scene references
    this.handlePointerMove = null;
    this.handleCanvasLeave = null;
    this.currentScene = null;
    this.registeredScenes.clear();
    this.isInitialized = false;
  }

  destroy(): void {
    this.cleanup();
  }
}
