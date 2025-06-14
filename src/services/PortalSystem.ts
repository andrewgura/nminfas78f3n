// src/services/PortalSystem.ts
import { eventBus } from "@/utils/EventBus";
import { MapService } from "./MapService";

// Define interface for portal properties
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
  private cooldownTime: number = 500; // Prevent immediate re-entry (500ms)

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.GameObject) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Create portal detection zones from the interact-layer objects
   */
  setupPortals(): void {
    try {
      // Clean up existing portal areas and overlaps
      this.cleanup();

      // Get the interact layer from the scene
      const gameScene = this.scene as any;
      const currentMap = gameScene?.map?.key || "unknown-map";

      console.log(`PORTAL SETUP: Current map is ${currentMap}`);

      // ALWAYS create a fallback portal for noob-cave map to ensure players can exit
      if (currentMap === "noob-cave-map" || currentMap === "unknown-map") {
        console.log(`Creating guaranteed exit portal for ${currentMap}`);
        this.createFallbackPortal(currentMap);

        // Continue processing normal portals as well
        console.log(`Continuing to look for regular portals...`);
      }

      // CRITICAL DEBUG: Log the entire map object to see what's available
      console.log(`DETAILED MAP DEBUG for ${currentMap}:`, gameScene.map);

      // Check if interact layer exists
      if (!gameScene.interactLayer) {
        console.warn(`No interact-layer found in map ${currentMap}. Checking all layers...`);

        // Try to find the interact layer by directly accessing the map layers
        if (gameScene.map && gameScene.map.objects) {
          const layerNames = Object.keys(gameScene.map.objects);
          console.log(`Available object layers: ${layerNames.join(", ")}`);

          // Try to find any layer with "interact" in the name
          const interactLayerName = layerNames.find((name) =>
            name.toLowerCase().includes("interact")
          );
          if (interactLayerName) {
            console.log(`Found potential interact layer: ${interactLayerName}`);
            gameScene.interactLayer = gameScene.map.objects[interactLayerName];
          }
        }

        // If we still don't have an interact layer, check all layers
        if (!gameScene.interactLayer && gameScene.map) {
          console.log(`Examining all map layers to find portals...`);

          // Get all object layers
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
            console.log(`Found ${objectLayers.length} object layers:`, objectLayers);

            // Use the first object layer that has any objects
            for (const layer of objectLayers) {
              if (layer.objects && layer.objects.length > 0) {
                console.log(
                  `Using object layer '${layer.name}' with ${layer.objects.length} objects`
                );
                gameScene.interactLayer = layer;
                break;
              }
            }
          } else {
            console.warn(`No object layers found in map ${currentMap}`);
          }
        }
      }

      // If still no interact layer, check map properties for portal definitions
      if (!gameScene.interactLayer) {
        console.warn(
          `No usable interact layer found, checking map properties for portal definitions`
        );

        // Check if the map has properties that define a portal
        if (gameScene.map && gameScene.map.properties) {
          const portalProps = gameScene.map.properties.find(
            (prop: any) => prop.name === "portal" || prop.name === "hasPortal"
          );

          if (portalProps) {
            console.log(`Found portal definition in map properties`);
            // Create a synthetic portal based on map properties
            this.createSyntheticPortal(gameScene.map.properties);
            return;
          }
        }

        console.error(`No interact layer or portal properties found in map ${currentMap}`);
        return;
      }

      // Process all objects in the interact layer
      if (!gameScene.interactLayer.objects) {
        console.error(`Interact layer has no objects array in map ${currentMap}`);
        console.log(`Interact layer structure:`, gameScene.interactLayer);
        return;
      }

      console.log(`Setting up portals for map ${currentMap}`);
      console.log(`Interact layer objects: ${gameScene.interactLayer.objects.length || 0}`);

      // Try to find portal objects in the interact layer
      const portalObjects = gameScene.interactLayer.objects.filter((obj: any) => {
        const type = this.getObjectProperty(obj, "type");
        const isPortal = type === "portal" || type === "stair" || type === "teleport";

        if (isPortal) {
          console.log(`Found portal object:`, obj);
        }

        return isPortal;
      });

      if (portalObjects.length === 0) {
        console.warn(`No portal objects found in the interact layer of map ${currentMap}`);
        return;
      }

      console.log(`Found ${portalObjects.length} portal objects in map ${currentMap}`);

      // Create a zone for each portal object
      portalObjects.forEach((portalObj: any) => {
        this.createPortalZone(portalObj);
      });
    } catch (error) {
      console.error("Error in PortalSystem.setupPortals:", error);
      eventBus.emit("error.portal.setup", { error });
    }
  }

  /**
   * Create a fallback portal for development/testing
   */
  private createFallbackPortal(currentMap: string): void {
    try {
      console.log(`Creating fallback portals for map: ${currentMap}`);

      // Default values based on the current map
      const targetMap = "game-map";
      const targetX = 9;
      const targetY = -7;
      const direction = "up";

      // Define multiple potential portal positions to try
      // This ensures at least one portal will be visible near the stairs
      const portalPositions = [
        // Top area
        { x: 8, y: 2 },
        // Middle area
        { x: 8, y: 8 },
        // Bottom area - where the stairs appear to be
        { x: 8, y: 16 },
        // Corners
        { x: 2, y: 2 },
        { x: 18, y: 2 },
        { x: 2, y: 16 },
        { x: 18, y: 16 },
        // Additional positions to cover the map
        { x: 8, y: 12 },
        { x: 15, y: 8 },
        { x: 4, y: 8 },
        // Try position exactly on the visible stairs
        { x: 8, y: 20 },
      ];

      // Place a portal at each position with different colors
      const colors = [
        0xffff00, // yellow
        0xff0000, // red
        0x00ff00, // green
        0x0000ff, // blue
        0xff00ff, // purple
        0x00ffff, // cyan
        0xffa500, // orange
        0xffffff, // white
        0x00ff88, // teal
        0xff88ff, // pink
        0x88ff00, // lime
      ];

      // Create a portal at each position
      portalPositions.forEach((pos, index) => {
        // Convert to Phaser coordinates
        const phaserCoords = MapService.tiledToPhaser(currentMap, pos.x, pos.y);

        console.log(
          `Creating FALLBACK PORTAL ${index} at Tiled(${pos.x}, ${pos.y}) -> Phaser(${phaserCoords.x}, ${phaserCoords.y})`
        );

        // Create a zone at the portal position
        const portalZone = this.scene.add.zone(
          phaserCoords.x,
          phaserCoords.y,
          32, // Full tile width for easier activation
          32 // Full tile height for easier activation
        );

        // Add physics to the zone
        this.scene.physics.add.existing(portalZone, true);

        // Store portal properties
        (portalZone as any).portalProperties = {
          targetMap,
          targetX,
          targetY,
          direction,
          tiledPosition: { x: pos.x, y: pos.y },
        } as PortalProperties;

        // Set up overlap detection
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

        // Use a different color for each portal for identification
        const color = colors[index % colors.length];

        // Add a very visible debug visualization
        const graphics = this.scene.add.graphics();

        // Draw a square
        graphics.lineStyle(3, color, 1);
        graphics.strokeRect(phaserCoords.x - 16, phaserCoords.y - 16, 32, 32);

        // Add a text label showing the portal number
        const text = this.scene.add.text(phaserCoords.x, phaserCoords.y, `${index}`, {
          font: "16px Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        });
        text.setOrigin(0.5);

        // Only add the main "EXIT PORTAL" text to the first portal
        if (index === 0) {
          const mainText = this.scene.add.text(phaserCoords.x, phaserCoords.y - 40, "EXIT PORTAL", {
            font: "16px Arial",
            color: "#ffff00",
            stroke: "#000000",
            strokeThickness: 4,
          });
          mainText.setOrigin(0.5);
          (portalZone as any).mainText = mainText;
        }

        // Store graphics for cleanup
        (portalZone as any).debugGraphics = graphics;
        (portalZone as any).debugText = text;
      });

      console.log(`Multiple fallback portals created successfully`);
    } catch (error) {
      console.error("Error creating fallback portals:", error);
    }
  }

  /**
   * Create a synthetic portal based on map properties
   */
  private createSyntheticPortal(mapProperties: any[]): void {
    try {
      // Extract portal information from map properties
      const targetMapProp = mapProperties.find((prop: any) => prop.name === "portalTargetMap");
      const targetXProp = mapProperties.find((prop: any) => prop.name === "portalTargetX");
      const targetYProp = mapProperties.find((prop: any) => prop.name === "portalTargetY");
      const portalXProp = mapProperties.find((prop: any) => prop.name === "portalX");
      const portalYProp = mapProperties.find((prop: any) => prop.name === "portalY");
      const directionProp = mapProperties.find((prop: any) => prop.name === "portalDirection");

      if (!targetMapProp || !targetXProp || !targetYProp) {
        console.error("Missing required portal properties in map");
        return;
      }

      // Get values
      const currentMap = (this.scene as any)?.map?.key || "unknown-map";
      const targetMap = targetMapProp.value;
      const targetX = parseInt(targetXProp.value);
      const targetY = parseInt(targetYProp.value);
      const direction = directionProp ? directionProp.value : "none";

      // Use provided portal position or default to (0,0)
      const portalX = portalXProp ? parseInt(portalXProp.value) : 0;
      const portalY = portalYProp ? parseInt(portalYProp.value) : 0;

      // Convert to Phaser coordinates
      const phaserCoords = MapService.tiledToPhaser(currentMap, portalX, portalY);

      console.log(
        `Creating synthetic portal at Tiled(${portalX}, ${portalY}) -> Phaser(${phaserCoords.x}, ${phaserCoords.y})`
      );
      console.log(`Target: ${targetMap} at Tiled(${targetX}, ${targetY})`);

      // Create a zone at the portal position
      const portalZone = this.scene.add.zone(
        phaserCoords.x,
        phaserCoords.y,
        32, // Full tile width
        32 // Full tile height
      );

      // Add physics to the zone
      this.scene.physics.add.existing(portalZone, true);

      // Store portal properties
      (portalZone as any).portalProperties = {
        targetMap,
        targetX,
        targetY,
        direction,
        tiledPosition: { x: portalX, y: portalY },
      } as PortalProperties;

      // Set up overlap detection
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

      // Debug visualization
      const graphics = this.scene.add.graphics();
      graphics.lineStyle(2, 0x00ff00, 0.5);
      graphics.strokeRect(phaserCoords.x - 16, phaserCoords.y - 16, 32, 32);
      (portalZone as any).debugGraphics = graphics;

      console.log(`Synthetic portal created successfully`);
    } catch (error) {
      console.error("Error creating synthetic portal:", error);
    }
  }

  /**
   * Create a collision zone for a portal object and set up overlap detection
   */
  private createPortalZone(portalObj: any): void {
    try {
      // Get the current map key
      const gameScene = this.scene as any;
      const currentMap = gameScene?.map?.key || "game-map";

      // Get map chunk info
      const mapConfig = MapService.getMap(currentMap);
      const chunkStartX = mapConfig?.chunkInfo?.startX || 0;
      const chunkStartY = mapConfig?.chunkInfo?.startY || 0;

      // Get portal properties
      const portalType = this.getObjectProperty(portalObj, "type");
      const targetMap = this.getObjectProperty(portalObj, "targetMap");
      const targetX = this.getObjectProperty(portalObj, "targetX");
      const targetY = this.getObjectProperty(portalObj, "targetY");
      const direction = this.getObjectProperty(portalObj, "direction") || "none";

      // Log the object's raw data for debugging
      console.log(`Portal object data:`, portalObj);
      console.log(
        `Portal properties: type=${portalType}, targetMap=${targetMap}, targetX=${targetX}, targetY=${targetY}, direction=${direction}`
      );

      // Get the exact Tiled coordinates
      // If the object has width and height, it's a rectangle drawn in Tiled
      const tileSize = 32; // Standard tile size
      let tiledX, tiledY;

      if (portalObj.width && portalObj.height) {
        // For objects placed in Tiled, we need to account for the object's position
        // Tiled objects are positioned from top-left, so add half width/height to center
        const centerX = portalObj.x + portalObj.width / 2;
        const centerY = portalObj.y + portalObj.height / 2;

        // Convert the center position to tile coordinates
        tiledX = Math.floor(centerX / tileSize);
        tiledY = Math.floor(centerY / tileSize);
      } else {
        // Use direct coordinates if provided
        tiledX = portalObj.x;
        tiledY = portalObj.y;
      }

      console.log(`Portal object in Tiled at: (${tiledX}, ${tiledY})`);
      console.log(`Portal target: map ${targetMap} at (${targetX}, ${targetY})`);

      // Convert Tiled coordinates to Phaser world coordinates
      const phaserCoords = MapService.tiledToPhaser(currentMap, tiledX, tiledY);
      console.log(`Converted to Phaser coordinates: (${phaserCoords.x}, ${phaserCoords.y})`);

      // Create a zone at the exact center of the tile
      // Use a very small activation area to ensure only direct overlap triggers
      const portalZone = this.scene.add.zone(
        phaserCoords.x, // Exact center X
        phaserCoords.y, // Exact center Y
        24, // Slightly larger than minimum to ensure activation
        24 // Slightly larger than minimum to ensure activation
      );

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
        this.checkPortalActivation, // Add a custom process callback to check activation conditions
        this
      );

      // Store references for cleanup
      this.portalAreas.push(portalZone);
      this.portalOverlaps.push(overlap);

      // Debug visualization - show both the tile and the activation area
      if (process.env.NODE_ENV === "development" || true) {
        const graphics = this.scene.add.graphics();

        // Draw the full tile (32x32) in green
        graphics.lineStyle(2, 0x00ff00, 0.5);
        graphics.strokeRect(
          phaserCoords.x - 16, // Half tile width
          phaserCoords.y - 16, // Half tile height
          32, // Full tile width
          32 // Full tile height
        );

        // Draw the activation area (24x24) in red
        graphics.lineStyle(2, 0xff0000, 0.8);
        graphics.strokeRect(
          phaserCoords.x - 12, // Half activation width
          phaserCoords.y - 12, // Half activation height
          24, // Activation width
          24 // Activation height
        );

        (portalZone as any).debugGraphics = graphics;
      }

      console.log(`Created portal zone to ${targetMap} at Tiled(${targetX}, ${targetY})`);
    } catch (error) {
      console.error("Error creating portal zone:", error);
      eventBus.emit("error.portal.zone", { error });
    }
  }

  /**
   * Check if the portal should be activated based on player position
   * This is used as a process callback for the overlap detection
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
      // Don't activate if we're already transitioning or on cooldown
      if (this.isTransitioning || this.portalCooldown > 0) return false;

      // Get the body objects - we need to check what type of objects we received
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
        console.warn("Unable to get player body for portal activation check");
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
        console.warn("Unable to get portal body for activation check");
        return false;
      }

      // Only activate if the player's center is very close to the portal's center
      const playerX = playerBody.center.x;
      const playerY = playerBody.center.y;
      const portalX = portalBody.center.x;
      const portalY = portalBody.center.y;

      // Calculate distance between centers
      const distanceX = Math.abs(playerX - portalX);
      const distanceY = Math.abs(playerY - portalY);

      // Allow activation only if player is very close to center of portal
      const maxDistance = 16; // Maximum distance for activation (pixels) - slightly increased for better detection
      const canActivate = distanceX <= maxDistance && distanceY <= maxDistance;

      // If debugging, log when the player is close to but not activating a portal
      if (distanceX <= 24 && distanceY <= 24) {
        console.log(
          `Player near portal: Distance (${distanceX.toFixed(1)}, ${distanceY.toFixed(1)}), Activating: ${canActivate}`
        );
      }

      return canActivate;
    } catch (error) {
      console.error("Error in portal activation check:", error);
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
      // Don't need to check cooldown/transition here as it's already done in checkPortalActivation
      const gameScene = this.scene as any;
      if (gameScene.isChangingMap) return;

      // Get portal properties - ensure portalZone is a GameObject
      if (!("portalProperties" in portalZone)) {
        console.warn("Portal zone object does not have portalProperties");
        return;
      }

      // Type assertion for TypeScript
      const portalProps = portalZone.portalProperties as PortalProperties;
      if (!portalProps) {
        console.error("Portal properties are undefined");
        return;
      }

      const targetMap = portalProps.targetMap;
      const tiledX = portalProps.targetX;
      const tiledY = portalProps.targetY;
      const direction = portalProps.direction;
      const tiledPosition = portalProps.tiledPosition;

      // Don't proceed if target map is missing
      if (!targetMap) {
        console.error("Portal missing target map");
        return;
      }

      console.log(
        `Portal activated! Current position: Tiled(${tiledPosition?.x}, ${tiledPosition?.y})`
      );
      console.log(`Target destination: Map ${targetMap} at Tiled(${tiledX}, ${tiledY})`);

      // Convert from Tiled coordinates to Phaser coordinates
      const phaserCoords = MapService.tiledToPhaser(targetMap, tiledX, tiledY);

      console.log(`Converted target to Phaser coordinates: (${phaserCoords.x}, ${phaserCoords.y})`);

      // Set transitioning flag to prevent multiple triggers
      this.isTransitioning = true;

      // Create appropriate message based on the portal direction
      let message = "";
      if (direction === "up") {
        message = "You climb up the stairs.";
      } else if (direction === "down") {
        message = "You descend down the stairs.";
      } else {
        message = "You are teleported to a new location.";
      }

      // Trigger the map change
      gameScene.changeMap(targetMap, phaserCoords.x, phaserCoords.y, message);

      // Set a cooldown to prevent immediate re-triggering when arriving at destination
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
    // Update cooldown if necessary
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
      // Destroy all portal overlaps
      this.portalOverlaps.forEach((overlap) => {
        if (overlap) overlap.destroy();
      });
      this.portalOverlaps = [];

      // Destroy all portal zones and their debug graphics
      this.portalAreas.forEach((zone) => {
        if ((zone as any).debugGraphics) {
          (zone as any).debugGraphics.destroy();
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
