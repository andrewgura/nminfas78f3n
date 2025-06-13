import { Component } from "../Component";
import { Character } from "../Character";
import { eventBus } from "@/utils/EventBus";

interface Scene extends Phaser.Scene {
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  monsters?: Phaser.GameObjects.Group;
}

export class MovementComponent extends Component {
  tileSize: number = 32;
  facing: string = "down";
  isMoving: boolean = false;
  moveSpeed: number = 100;

  constructor(entity: Character) {
    super(entity);
  }

  get character(): Character {
    return this.entity as Character;
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
      });

      // Use tweening for smooth movement
      this.entity.scene.tweens.add({
        targets: this.entity,
        x: x,
        y: y,
        duration: this.moveSpeed,
        ease: "Linear",
        onComplete: () => {
          this.isMoving = false;

          // Emit movement complete event
          eventBus.emit("entity.movement.complete", {
            entityId: this.entity.id,
            position: { x, y },
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
      const gameScene = scene as Scene;
      if (!gameScene.collisionLayer) return false;

      const tileX = Math.floor((x - gameScene.collisionLayer.x) / this.tileSize);
      const tileY = Math.floor((y - gameScene.collisionLayer.y) / this.tileSize);
      const tile = gameScene.collisionLayer.getTileAt(tileX, tileY);

      return tile?.collides || false;
    } catch (error) {
      console.error("Error in MovementComponent.collidesWithTerrain:", error);
      return false;
    }
  }

  collidesWithEntity(scene: Phaser.Scene, x: number, y: number): boolean {
    try {
      const targetTileX = Math.floor(x / this.tileSize);
      const targetTileY = Math.floor(y / this.tileSize);

      // Check for collision with monsters
      const gameScene = scene as Scene;
      if (gameScene.monsters) {
        const collides = gameScene.monsters.getChildren().some((monster: any) => {
          if (monster === this.entity) return false; // Don't collide with self

          const monsterTileX = Math.floor(monster.x / this.tileSize);
          const monsterTileY = Math.floor(monster.y / this.tileSize);

          return monsterTileX === targetTileX && monsterTileY === targetTileY;
        });

        if (collides) return true;
      }

      return false;
    } catch (error) {
      console.error("Error in MovementComponent.collidesWithEntity:", error);
      return false;
    }
  }
}
