// src/entities/Chest.ts
import { Entity } from "./Entity";
import { eventBus } from "@/utils/EventBus";

export class Chest extends Entity {
  public lootTable: string = "default";
  public respawnTime: number = 300; // in seconds
  public isOpen: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    lootTable: string = "default",
    respawnTime: number = 300
  ) {
    super(scene, x, y, "chest-closed", id);

    this.lootTable = lootTable;
    this.respawnTime = respawnTime;

    // Set up physics for the chest sprite
    this.setupPhysics();
  }

  private setupPhysics(): void {
    try {
      // Enable physics for the chest (static body)
      this.scene.physics.add.existing(this, true);

      // Set the physics body size to match the chest sprite
      if (this.body && "setSize" in this.body) {
        (this.body as Phaser.Physics.Arcade.Body).setSize(32, 32);
      }
    } catch (error) {
      console.error("Error setting up chest physics:", error);
    }
  }

  /**
   * Check if this chest can be opened
   */
  public canOpen(): boolean {
    return !this.isOpen && this.active;
  }

  /**
   * Get the distance from a point to this chest
   */
  public getDistanceFrom(x: number, y: number): number {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y);
  }

  update(time: number, delta?: number): void {
    try {
      super.update(time, delta);
      // Chests are static, so minimal update logic needed
    } catch (error) {
      console.error("Error in Chest update:", error);
    }
  }

  destroy(): void {
    try {
      super.destroy();
    } catch (error) {
      console.error("Error destroying chest:", error);
    }
  }
}
