// src/services/PortalSystem.ts
import { eventBus } from "@/utils/EventBus";
import { MapService } from "./MapService";
import { useGameStore } from "@/stores/gameStore";

interface PortalProperties {
  targetMap: string;
  targetX: number;
  targetY: number;
  direction: string;
  tiledPosition?: { x: number; y: number };
}

export class PortalSystem {
  private scene: Phaser.Scene;
  private player: Phaser.GameObjects.GameObject;
  private portalOverlaps: Phaser.Physics.Arcade.Collider[] = [];
  private portalAreas: Phaser.GameObjects.Zone[] = [];
  private isTransitioning: boolean = false;
  private portalCooldown: number = 0;
  private cooldownTime: number = 500;

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.GameObject) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Create portal detection zones from the interact-layer objects
   */
  setupPortals(): void {
    try {
      this.cleanup();

      const gameScene = this.scene as any;
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (!currentMap) {
        return;
      }

      // Find interact layer
      if (!gameScene.interactLayer) {
        if (gameScene.map && gameScene.map.objects) {
          const layerNames = Object.keys(gameScene.map.objects);
          const interactLayerName = layerNames.find((name) =>
            name.toLowerCase().includes("interact")
          );
          if (interactLayerName) {
            gameScene.interactLayer = gameScene.map.objects[interactLayerName];
          }
        }

        if (!gameScene.interactLayer && gameScene.map) {
          const objectLayers = [];
          if (gameScene.map.objects) {
            for (const layerName in gameScene.map.objects) {
              objectLayers.push({
                name: layerName,
                objects: gameScene.map.objects[layerName],
              });
            }
          }

          if (objectLayers.length > 0) {
            for (const layer of objectLayers) {
              if (layer.objects && layer.objects.length > 0) {
                gameScene.interactLayer = layer;
                break;
              }
            }
          }
        }
      }

      // Process portal objects from the interact layer
      if (gameScene.interactLayer) {
        const portalObjects = gameScene.interactLayer.objects || [];
        portalObjects.forEach((portalObj: any) => {
          this.createPortalZone(portalObj);
        });
      }
    } catch (error) {
      console.error("Error in PortalSystem.setupPortals:", error);
      eventBus.emit("error.portal.setup", { error });
    }
  }

  /**
   * Create a collision zone for a portal object and set up overlap detection
   */
  private createPortalZone(portalObj: any): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      const mapConfig = MapService.getMap(currentMap);
      const chunkStartX = mapConfig?.chunkInfo?.startX || 0;
      const chunkStartY = mapConfig?.chunkInfo?.startY || 0;

      // Get portal properties
      const portalType = this.getObjectProperty(portalObj, "type");
      const targetMap = this.getObjectProperty(portalObj, "targetMap");
      const targetX = this.getObjectProperty(portalObj, "targetX");
      const targetY = this.getObjectProperty(portalObj, "targetY");
      const direction = this.getObjectProperty(portalObj, "direction") || "none";

      // Get the exact Tiled coordinates
      const tileSize = 32;
      let tiledX, tiledY;

      if (portalObj.width && portalObj.height) {
        // For rectangular objects, use center point
        const centerX = portalObj.x + portalObj.width / 2;
        const centerY = portalObj.y + portalObj.height / 2;
        tiledX = Math.floor(centerX / tileSize);
        tiledY = Math.floor(centerY / tileSize);
      } else {
        // For point objects, convert pixel coordinates directly to tile coordinates
        tiledX = Math.floor(portalObj.x / tileSize);
        tiledY = Math.floor(portalObj.y / tileSize);
      }

      // Convert Tiled coordinates to Phaser world coordinates
      const phaserCoords = MapService.tiledToPhaser(currentMap, tiledX, tiledY);

      // Create a zone at the exact center of the tile
      const portalZone = this.scene.add.zone(phaserCoords.x, phaserCoords.y, 24, 24);

      // Add physics to the zone
      this.scene.physics.add.existing(portalZone, true);

      // Store portal properties in the zone object for later use
      (portalZone as any).portalProperties = {
        targetMap,
        targetX,
        targetY,
        direction,
        tiledPosition: { x: tiledX, y: tiledY },
      } as PortalProperties;

      // Set up overlap detection with the player
      const overlap = this.scene.physics.add.overlap(
        this.player,
        portalZone,
        this.handlePortalOverlap,
        this.checkPortalActivation,
        this
      );

      // Store references for cleanup
      this.portalAreas.push(portalZone);
      this.portalOverlaps.push(overlap);

      // Debug visualization (only in development)
      if (process.env.NODE_ENV === "development") {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0x00ff00, 0.5);
        graphics.strokeRect(phaserCoords.x - 16, phaserCoords.y - 16, 32, 32);
        graphics.lineStyle(2, 0xff0000, 0.8);
        graphics.strokeRect(phaserCoords.x - 12, phaserCoords.y - 12, 24, 24);
        (portalZone as any).debugGraphics = graphics;
      }
    } catch (error) {
      console.error("Error creating portal zone:", error);
      eventBus.emit("error.portal.zone", { error });
    }
  }

  /**
   * Check if the portal should be activated based on player position
   */
  private checkPortalActivation(
    _player:
      | Phaser.GameObjects.GameObject
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody,
    _portalZone:
      | Phaser.GameObjects.GameObject
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
  ): boolean {
    try {
      if (this.isTransitioning || this.portalCooldown > 0) return false;

      let playerBody: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      let portalBody: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;

      if ("body" in _player) {
        playerBody = _player.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      } else if (
        _player instanceof Phaser.Physics.Arcade.Body ||
        _player instanceof Phaser.Physics.Arcade.StaticBody
      ) {
        playerBody = _player;
      } else {
        return false;
      }

      if ("body" in _portalZone) {
        portalBody = _portalZone.body as
          | Phaser.Physics.Arcade.Body
          | Phaser.Physics.Arcade.StaticBody;
      } else if (
        _portalZone instanceof Phaser.Physics.Arcade.Body ||
        _portalZone instanceof Phaser.Physics.Arcade.StaticBody
      ) {
        portalBody = _portalZone;
      } else {
        return false;
      }

      const playerX = playerBody.center.x;
      const playerY = playerBody.center.y;
      const portalX = portalBody.center.x;
      const portalY = portalBody.center.y;

      const distanceX = Math.abs(playerX - portalX);
      const distanceY = Math.abs(playerY - portalY);

      const maxDistance = 16;
      const canActivate = distanceX <= maxDistance && distanceY <= maxDistance;

      return canActivate;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle when the player overlaps with a portal zone
   */
  private handlePortalOverlap(
    _player:
      | Phaser.GameObjects.GameObject
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody,
    portalZone:
      | Phaser.GameObjects.GameObject
      | Phaser.Tilemaps.Tile
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
  ): void {
    try {
      const gameScene = this.scene as any;
      if (gameScene.isChangingMap) return;

      if (!("portalProperties" in portalZone)) {
        return;
      }

      const portalProps = portalZone.portalProperties as PortalProperties;
      if (!portalProps) {
        return;
      }

      const targetMap = portalProps.targetMap;
      const tiledX = portalProps.targetX;
      const tiledY = portalProps.targetY;
      const direction = portalProps.direction;

      if (!targetMap) {
        return;
      }

      // FIXED: Convert coordinates BEFORE starting transition to avoid race conditions
      const phaserCoords = MapService.tiledToPhaser(targetMap, tiledX, tiledY);

      // Validate coordinates to catch conversion errors
      if (phaserCoords.x === 0 && phaserCoords.y === 0) {
        console.error(
          `Invalid coordinates converted for ${targetMap} at Tiled(${tiledX}, ${tiledY})`
        );
        return;
      }

      this.isTransitioning = true;

      let message = "";
      if (direction === "up") {
        message = "You climb up the stairs.";
      } else if (direction === "down") {
        message = "You descend down the stairs.";
      } else {
        message = "You are teleported to a new location.";
      }

      gameScene.changeMap(targetMap, phaserCoords.x, phaserCoords.y, message);

      this.portalCooldown = this.cooldownTime;
      this.scene.time.delayedCall(this.cooldownTime, () => {
        this.portalCooldown = 0;
        this.isTransitioning = false;
      });
    } catch (error) {
      this.isTransitioning = false;
      console.error("Error in portal overlap handler:", error);
      eventBus.emit("error.portal.transition", { error });
    }
  }

  /**
   * Update method to be called in the scene's update loop
   */
  update(time: number, delta: number): void {
    if (this.portalCooldown > 0) {
      this.portalCooldown -= delta;
      if (this.portalCooldown < 0) this.portalCooldown = 0;
    }
  }

  /**
   * Clean up portal zones and overlaps
   */
  cleanup(): void {
    try {
      this.portalOverlaps.forEach((overlap) => {
        if (overlap) overlap.destroy();
      });
      this.portalOverlaps = [];

      this.portalAreas.forEach((zone) => {
        if ((zone as any).debugGraphics) {
          (zone as any).debugGraphics.destroy();
        }
        if ((zone as any).debugText) {
          (zone as any).debugText.destroy();
        }
        zone.destroy();
      });
      this.portalAreas = [];

      this.isTransitioning = false;
      this.portalCooldown = 0;
    } catch (error) {
      console.error("Error cleaning up portal system:", error);
    }
  }

  /**
   * Helper method to get a property from a Tiled object
   */
  private getObjectProperty(obj: any, propertyName: string): any {
    if (!obj || !obj.properties) return null;
    const property = obj.properties.find((prop: any) => prop.name === propertyName);
    return property ? property.value : null;
  }
}
