import Phaser from "phaser";
import { ComponentManager } from "./ComponentManager";
import { useGameStore } from "@/stores/gameStore";
import { eventBus } from "@/utils/EventBus";

export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  id: string;
  components!: ComponentManager;
  color: number | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, id: string) {
    // Snap to grid center on spawn
    const centerX = Math.floor(x / 32) * 32 + 16;
    const centerY = Math.floor(y / 32) * 32 + 16;

    super(scene, centerX, centerY, texture);
    this.id = id;

    try {
      scene.add.existing(this);
      scene.physics.add.existing(this);

      this.components = new ComponentManager(this);

      // Set up base sprite properties
      this.setDepth(5);
      this.setCollideWorldBounds(true);

      // Register entity creation with event system
      eventBus.emit("entity.created", { id: this.id, type: this.constructor.name });
    } catch (error) {
      console.error(`Error initializing entity ${id}:`, error);
      eventBus.emit("error.entity", { id, error });
      return;
    }
  }

  update(time: number, delta?: number): void {
    try {
      this.components.update(time, delta || 0);
    } catch (error) {
      console.error(`Error updating entity ${this.id}:`, error);
      eventBus.emit("error.entity.update", { id: this.id, error });
    }
  }

  destroy(): void {
    try {
      // Notify system before destroying
      eventBus.emit("entity.destroyed", { id: this.id, type: this.constructor.name });

      this.components.destroy();
      super.destroy();
    } catch (error) {
      console.error(`Error destroying entity ${this.id}:`, error);
      eventBus.emit("error.entity.destroy", { id: this.id, error });
    }
  }
}
