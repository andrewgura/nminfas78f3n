import { Component } from "../Component";
import { Character } from "../Character";
import { useGameStore } from "@/stores/gameStore";
import { MapService } from "@/services/MapService";
import { eventBus } from "@/utils/EventBus";

interface Portal {
  id: string;
  sourceMap: string;
  sourceX: number;
  sourceY: number;
  radius: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  message?: string;
}

interface SceneWithChangeMap extends Phaser.Scene {
  changeMap(mapKey: string, destX: number, destY: number, message?: string): void;
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  monsters?: Phaser.GameObjects.Group;
}

export class MovementComponent extends Component {
  speed: number = 5;
  tileSize: number = 32;
  moveDelay: number = 5;
  lastMoveTime: number = 0;
  facing: string = "down";
  isMoving: boolean = false;

  constructor(entity: Character, speed: number = 900) {
    super(entity);
    this.speed = speed;
  }

  get character(): Character {
    return this.entity as Character;
  }

  moveToPosition(x: number, y: number, time: number): void {
    try {
      // Don't start a new movement if we're already moving
      if (this.isMoving) return;

      this.isMoving = true;
      this.lastMoveTime = time;

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
        duration: 70, // Adjust for desired speed (lower = faster)
        ease: "Linear",
        onComplete: () => {
          this.isMoving = false;

          // Emit movement complete event
          eventBus.emit("entity.movement.complete", {
            entityId: this.entity.id,
            position: { x, y },
          });

          // Check for portal at destination
          this.checkForPortal(x, y);
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
      const gameScene = scene as SceneWithChangeMap;
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
      const gameScene = scene as SceneWithChangeMap;
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

  checkForPortal(x: number, y: number): void {
    try {
      // Get current map
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Check if there's a portal at current position
      const portal = MapService.checkPortalAtPosition(x, y, currentMap);

      if (portal) {
        this.usePortal(this.entity.scene, portal);
      }
    } catch (error) {
      console.error("Error checking for portal:", error);
    }
  }

  private usePortal(scene: Phaser.Scene, portal: Portal): void {
    try {
      const gameScene = scene as SceneWithChangeMap;

      // Check if the game scene has the changeMap method
      if (gameScene.changeMap) {
        gameScene.changeMap(portal.targetMap, portal.targetX, portal.targetY, portal.message);

        // Emit portal used event
        eventBus.emit("portal.used", {
          portalId: portal.id,
          targetMap: portal.targetMap,
          targetPosition: { x: portal.targetX, y: portal.targetY },
        });
      } else {
        // Fallback to just updating the map in gameState
        useGameStore.getState().updatePlayerMap(portal.targetMap);
        console.warn(
          "Game scene doesn't have changeMap method - map changed but player not teleported"
        );
      }
    } catch (error) {
      console.error("Error in MovementComponent.usePortal:", error);
      eventBus.emit("error.portal.use", {
        entityId: this.entity.id,
        portalId: portal.id,
        error,
      });
    }
  }

  updatePlayerMap(mapKey: string): void {
    try {
      // Update the map in the game state
      useGameStore.getState().updatePlayerMap(mapKey);

      // Log the map change
      console.log(`Player map updated to: ${mapKey}`);

      // Emit map change event
      eventBus.emit("player.map.changed", { mapKey });
    } catch (error) {
      console.error("Error in MovementComponent.updatePlayerMap:", error);
      eventBus.emit("error.map.change", {
        entityId: this.entity.id,
        mapKey,
        error,
      });
    }
  }
}
