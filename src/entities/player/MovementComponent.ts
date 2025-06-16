import { Component } from "../Component";
import { Character } from "../Character";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";

interface Scene extends Phaser.Scene {
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  monsters?: Phaser.GameObjects.Group;
}

export class MovementComponent extends Component {
  tileSize: number = 32;
  facing: string = "down";
  isMoving: boolean = false;
  private moveSpeed: number = 100; // Default fallback value

  constructor(entity: Character) {
    super(entity);

    // Initialize move speed from GameStore
    this.updateMoveSpeedFromStore();

    // Listen for move speed updates
    eventBus.on("player.moveSpeed.updated", this.handleMoveSpeedUpdate.bind(this));
  }

  /**
   * Update move speed from GameStore calculated stats
   */
  private updateMoveSpeedFromStore(): void {
    try {
      const gameState = useGameStore.getState();

      // Use actualMoveSpeed (internal value for movement timing)
      // Lower values = faster movement
      this.moveSpeed = gameState.calculatedStats.actualMoveSpeed;

      console.log(`MovementComponent: Updated move speed to ${this.moveSpeed}`);
    } catch (error) {
      console.error("Error updating move speed from store:", error);
      // Keep default fallback value
    }
  }

  /**
   * Handle move speed update events from GameStore
   */
  private handleMoveSpeedUpdate(data: { newSpeed: number; displaySpeed: number }): void {
    try {
      // Update our internal move speed with the new actualMoveSpeed
      this.moveSpeed = data.newSpeed;

      console.log(
        `MovementComponent: Move speed updated to ${this.moveSpeed} (display: ${data.displaySpeed})`
      );

      // Emit event for other systems that might need to know
      eventBus.emit("entity.movement.speed.updated", {
        entityId: this.entity.id,
        newSpeed: this.moveSpeed,
        displaySpeed: data.displaySpeed,
      });
    } catch (error) {
      console.error("Error handling move speed update:", error);
    }
  }

  get character(): Character {
    return this.entity as Character;
  }

  /**
   * Get current move speed (mainly for debugging/external access)
   */
  getMoveSpeed(): number {
    return this.moveSpeed;
  }

  moveToPosition(x: number, y: number, time: number): void {
    try {
      // Don't start a new movement if we're already moving
      if (this.isMoving) return;

      this.isMoving = true;

      // Emit movement start event
      eventBus.emit("entity.movement.start", {
        entityId: this.entity.id,
        position: { x, y },
        time,
        moveSpeed: this.moveSpeed,
      });

      // Use tweening for smooth movement with dynamic move speed
      this.entity.scene.tweens.add({
        targets: this.entity,
        x: x,
        y: y,
        duration: this.moveSpeed, // Now uses the actual calculated move speed
        ease: "Linear",
        onComplete: () => {
          this.isMoving = false;

          // Emit movement complete event
          eventBus.emit("entity.movement.complete", {
            entityId: this.entity.id,
            position: { x, y },
            moveSpeed: this.moveSpeed,
          });
        },
      });
    } catch (error) {
      this.isMoving = false;
      console.error("Error in MovementComponent.moveToPosition:", error);
      eventBus.emit("error.movement", {
        entityId: this.entity.id,
        targetPosition: { x, y },
        error,
      });
    }
  }

  isValidMove(scene: Phaser.Scene, nextX: number, nextY: number): boolean {
    try {
      // Basic collision checks
      if (!this.isWithinBounds(nextX, nextY)) return false;
      if (this.collidesWithTerrain(scene, nextX, nextY)) return false;
      if (this.collidesWithEntity(scene, nextX, nextY)) return false;

      return true;
    } catch (error) {
      console.error("Error in MovementComponent.isValidMove:", error);
      eventBus.emit("error.movement.validation", {
        entityId: this.entity.id,
        targetPosition: { x: nextX, y: nextY },
        error,
      });
      return false;
    }
  }

  isWithinBounds(x: number, y: number): boolean {
    try {
      const bounds = this.entity.scene.physics.world.bounds;
      const halfWidth = this.entity.width / 2;
      const halfHeight = this.entity.height / 2;

      return !(
        x - halfWidth < bounds.x ||
        x + halfWidth > bounds.x + bounds.width ||
        y - halfHeight < bounds.y ||
        y + halfHeight > bounds.y + bounds.height
      );
    } catch (error) {
      console.error("Error in MovementComponent.isWithinBounds:", error);
      return false;
    }
  }

  collidesWithTerrain(scene: Phaser.Scene, x: number, y: number): boolean {
    try {
      const sceneWithCollision = scene as Scene;
      if (!sceneWithCollision.collisionLayer) return false;

      const tileX = Math.floor(x / this.tileSize);
      const tileY = Math.floor(y / this.tileSize);

      const tile = sceneWithCollision.collisionLayer.getTileAt(tileX, tileY);
      return tile !== null;
    } catch (error) {
      console.error("Error in MovementComponent.collidesWithTerrain:", error);
      return false;
    }
  }

  collidesWithEntity(scene: Phaser.Scene, x: number, y: number): boolean {
    try {
      const sceneWithMonsters = scene as Scene;
      if (!sceneWithMonsters.monsters) return false;

      const monsters = sceneWithMonsters.monsters.children.entries;
      for (const monster of monsters) {
        if (!monster.active) continue;

        const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);
        if (distance < this.tileSize) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error in MovementComponent.collidesWithEntity:", error);
      return false;
    }
  }

  updateFacing(direction: { dx: number; dy: number }): void {
    try {
      if (direction.dx > 0) this.facing = "right";
      else if (direction.dx < 0) this.facing = "left";
      else if (direction.dy > 0) this.facing = "down";
      else if (direction.dy < 0) this.facing = "up";

      // Emit facing change event
      eventBus.emit("entity.facing.changed", {
        entityId: this.entity.id,
        facing: this.facing,
      });
    } catch (error) {
      console.error("Error in MovementComponent.updateFacing:", error);
    }
  }

  /**
   * Clean up event listeners when component is destroyed
   */
  destroy(): void {
    try {
      eventBus.off("player.moveSpeed.updated", this.handleMoveSpeedUpdate.bind(this));
      super.destroy();
    } catch (error) {
      console.error("Error destroying MovementComponent:", error);
    }
  }
}
