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
  private moveSpeed: number = 250; // Default base move speed

  constructor(entity: Character) {
    super(entity);

    // Initialize move speed from GameStore
    this.updateMoveSpeedFromStore();

    // Listen for move speed updates
    eventBus.on("player.moveSpeed.updated", this.handleMoveSpeedUpdate.bind(this));
  }

  /**
   * SIMPLIFIED: Update move speed from GameStore
   */
  private updateMoveSpeedFromStore(): void {
    try {
      const gameState = useGameStore.getState();

      this.moveSpeed = gameState.calculatedStats.totalMoveSpeed;
    } catch (error) {
      console.error("Error updating move speed from store:", error);
      this.moveSpeed = 250; // Fallback to base speed
    }
  }

  /**
   * Handle move speed update events from GameStore
   */
  private handleMoveSpeedUpdate(newSpeed: number): void {
    try {
      this.moveSpeed = newSpeed;

      // Emit event for other systems that might need to know
      eventBus.emit("entity.movement.speed.updated", {
        entityId: this.entity.id,
        newSpeed: this.moveSpeed,
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

  /**
   * Move to position - CORRECT SIGNATURE (3 parameters as expected by PlayerInputComponent)
   */
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

      // FIXED: Convert move speed to duration (higher speed = lower duration = faster movement)
      const baseDuration = 400; // Base time to move one tile (400ms)
      const baseMoveSpeed = 250; // Base move speed
      const duration = baseDuration * (baseMoveSpeed / this.moveSpeed);

      // Use tweening for smooth movement
      this.entity.scene.tweens.add({
        targets: this.entity,
        x: x,
        y: y,
        duration: Math.max(50, duration), // Minimum 50ms, maximum based on calculation
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

  /**
   * REQUIRED: Check if a move to the given position is valid
   */
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

  /**
   * Check if position is within world bounds
   */
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

  /**
   * Check if position collides with terrain/collision layer
   */
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

  /**
   * Check if position collides with other entities (monsters)
   */
  collidesWithEntity(scene: Phaser.Scene, x: number, y: number): boolean {
    try {
      const sceneWithMonsters = scene as Scene;
      if (!sceneWithMonsters.monsters) return false;

      const monsters = sceneWithMonsters.monsters.children.entries;
      for (const monster of monsters) {
        if (!monster.active) continue;

        // FIXED: Cast to get x/y properties
        const monsterSprite = monster as Phaser.GameObjects.Sprite;
        const distance = Phaser.Math.Distance.Between(x, y, monsterSprite.x, monsterSprite.y);
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

  /**
   * Update facing direction
   */
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
   * Move to a specific tile coordinate
   */
  moveToTile(tileX: number, tileY: number): Promise<void> {
    const targetX = tileX * this.tileSize + this.tileSize / 2;
    const targetY = tileY * this.tileSize + this.tileSize / 2;

    return new Promise((resolve) => {
      if (this.isMoving) {
        resolve();
        return;
      }

      const startX = this.entity.x;
      const startY = this.entity.y;
      const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);

      if (distance < 1) {
        resolve();
        return;
      }

      // FIXED: Convert move speed to duration (higher speed = faster movement)
      const baseDuration = 400; // Base time to move one tile
      const baseMoveSpeed = 250; // Base move speed
      const duration = baseDuration * (baseMoveSpeed / this.moveSpeed);

      this.isMoving = true;

      // Create movement tween
      this.entity.scene.tweens.add({
        targets: this.entity,
        x: targetX,
        y: targetY,
        duration: Math.max(50, duration), // Minimum 50ms
        ease: "Linear",
        onComplete: () => {
          this.isMoving = false;
          resolve();
        },
      });
    });
  }

  /**
   * Stop current movement
   */
  stopMovement(): void {
    if (this.isMoving) {
      this.entity.scene.tweens.killTweensOf(this.entity);
      this.isMoving = false;
    }
  }

  /**
   * Check if currently moving
   */
  getIsMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Get current facing direction
   */
  getFacing(): string {
    return this.facing;
  }

  /**
   * Clean up event listeners when component is destroyed
   */
  destroy(): void {
    try {
      eventBus.off("player.moveSpeed.updated", this.handleMoveSpeedUpdate);

      // Stop any ongoing movement
      this.stopMovement();

      super.destroy();
    } catch (error) {
      console.error("Error destroying MovementComponent:", error);
    }
  }
}
