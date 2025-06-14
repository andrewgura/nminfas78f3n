// src/scenes/GameScene.ts
import { eventBus } from "../utils/EventBus";
import { MapService } from "../services/MapService";
import { NPC, NPCData } from "../entities/NPC";
import { Item } from "@/entities/Item";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { CursorPositionSystem } from "@/services/CursorPositionSystem";
import { ItemHoverSystem } from "@/services/ItemHoverSystem";
import { useGameStore } from "@/stores/gameStore";
import { ItemBonusStats } from "@/types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { autoAttackSystem } from "@/services/AutoAttackSystem";
import { NPCService } from "@/services/NPCService";
import { Chest } from "@/entities/Chest";
import { PortalSystem } from "@/services/PortalSystem";

export class GameScene extends Phaser.Scene {
  declare playerCharacter: PlayerCharacter;
  declare items: Phaser.GameObjects.Group;
  declare monsters: Phaser.GameObjects.Group;
  declare npcs: Phaser.GameObjects.Group;
  declare chests: Phaser.GameObjects.Group;

  itemHoverSystem?: ItemHoverSystem;
  cursorPositionSystem!: CursorPositionSystem;
  portalSystem?: PortalSystem;
  map?: Phaser.Tilemaps.Tilemap;
  groundLayer?: Phaser.Tilemaps.TilemapLayer;
  chestLayer?: Phaser.Tilemaps.TilemapLayer;
  interactLayer?: Phaser.Tilemaps.ObjectLayer | null;
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  isChangingMap: boolean = false;

  constructor() {
    super({ key: "game" });
  }

  create(): void {
    try {
      // Get store state
      const store = useGameStore.getState();

      // Emit scene changed event
      eventBus.emit("scene.switched", this);

      // Load the Tiled map
      this.loadTiledMap();

      // Auto-analyze map chunks during development
      if (process.env.NODE_ENV === "development") {
        this.analyzeMapChunks();
      }

      // Create item, monster, and NPC groups
      this.createGameGroups();

      // Determine player spawn position
      let startX: number;
      let startY: number;

      // Check if we have teleport coordinates from a map transition
      if (store.playerCharacter.teleportPosition) {
        startX = store.playerCharacter.teleportPosition.x;
        startY = store.playerCharacter.teleportPosition.y;

        // Clear the teleport position after using it
        delete store.playerCharacter.teleportPosition;
      } else {
        // Otherwise use default positions for the current map
        const currentMap = store.currentMap;
        const defaultSpawn = MapService.getDefaultSpawn(currentMap);
        startX = defaultSpawn.x;
        startY = defaultSpawn.y;
      }

      // Create the player character at the determined position
      this.playerCharacter = new PlayerCharacter(this, startX, startY);

      // Set up camera to follow playerCharacter
      this.setupCamera();

      // Initialize game systems
      this.initializeGameSystems();

      // Setup input handlers
      this.setupInputHandlers();

      // Spawn initial content
      this.spawnInitialContent();

      // Emit game scene ready event
      eventBus.emit("game.scene.ready", { scene: this });
    } catch (error) {
      console.error("Error in GameScene.create:", error);
      eventBus.emit("ui.error.show", `Error creating game scene: ${(error as Error).message}`);
    }
  }

  update(time: number, delta: number): void {
    try {
      // Update portal system
      if (this.portalSystem) {
        this.portalSystem.update(time, delta);
      }

      // Update player character
      if (this.playerCharacter) {
        this.playerCharacter.update(time);
      }

      // Update monsters
      if (this.monsters) {
        this.monsters.getChildren().forEach((monster) => {
          (monster as any).update(time);
        });
      }

      // Update NPCs
      if (this.npcs) {
        this.npcs.getChildren().forEach((npc) => {
          (npc as any).update(time);
        });
      }
    } catch (error) {
      console.error("Error in GameScene.update:", error);
    }
  }

  // =============================================================================
  // INITIALIZATION METHODS
  // =============================================================================

  private createGameGroups(): void {
    this.items = this.add.group();
    this.monsters = this.add.group();
    this.npcs = this.add.group();
    this.chests = this.add.group();
  }

  private setupCamera(): void {
    this.cameras.main.startFollow(
      this.playerCharacter,
      true, // roundPixels
      100, // lerpX
      100, // lerpY
      0, // offsetX
      0 // offsetY
    );
    this.cameras.main.setZoom(1.4);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private initializeGameSystems(): void {
    try {
      const store = useGameStore.getState();

      // Clean up existing systems
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }

      // Initialize systems
      this.itemHoverSystem = new ItemHoverSystem();
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);

      // Register systems
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);
      store.registerSystem("gameScene", this);
      store.registerSystem("autoAttackSystem", autoAttackSystem);

      // Setup systems
      this.itemHoverSystem.setupGlobalPointerHandler(this);
      this.cursorPositionSystem.initialize();
      autoAttackSystem.initialize();

      // Initialize portal system for stair/teleport functionality
      this.initPortalSystem();

      // Setup collisions
      this.setupCollisions();

      console.log("Game systems initialized successfully");
    } catch (error) {
      console.error("Error initializing game systems:", error);
    }
  }

  /**
   * Initialize the portal system to handle stairs and teleports
   */
  private initPortalSystem(): void {
    try {
      // Clean up existing portal system first
      if (this.portalSystem) {
        this.portalSystem.cleanup();
      }

      // Create new portal system if player exists
      if (this.playerCharacter) {
        this.portalSystem = new PortalSystem(this, this.playerCharacter);
        this.portalSystem.setupPortals();
        console.log("Portal system initialized");
      }
    } catch (error) {
      console.error("Error initializing portal system:", error);
      eventBus.emit("error.portal.init", { error });
    }
  }

  private setupInputHandlers(): void {
    this.input.keyboard?.on("keydown-E", () => {
      if (this.playerCharacter) {
        this.playerCharacter.pickupNearbyItem();
      }
    });
  }

  private spawnInitialContent(): void {
    this.spawnInitialMonsters();
    this.spawnInitialNPCs();
    this.spawnTestItems();
  }

  /**
   * Analyze map chunks during development to help determine correct chunkInfo values
   */
  private analyzeMapChunks(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Import the MapChunkCalculator dynamically to avoid issues in production
      import("@/utils/MapChunkCalculator")
        .then(({ MapChunkCalculator }) => {
          const analysis = MapChunkCalculator.analyzeTiledMap(currentMap, this);

          if (analysis) {
            // Compare with current configuration
            const currentConfig = MapService.getMap(currentMap);
            if (currentConfig && currentConfig.chunkInfo) {
              console.log("Current configuration:", currentConfig.chunkInfo);
              console.log(
                "Matches suggested values:",
                currentConfig.chunkInfo.startX === analysis.chunkInfo.startX &&
                  currentConfig.chunkInfo.startY === analysis.chunkInfo.startY
              );
            }
          }
        })
        .catch((err) => {
          console.error("Error loading MapChunkCalculator:", err);
        });
    } catch (error) {
      console.error("Error analyzing map chunks:", error);
    }
  }

  // =============================================================================
  // MAP LOADING AND MANAGEMENT
  // =============================================================================

  loadTiledMap(): boolean {
    try {
      // Create the map using current map key from store
      const store = useGameStore.getState();
      const mapKey = store.currentMap;
      this.map = this.make.tilemap({ key: mapKey });

      // Get all tilesets from the map data
      const tilesetImages: Phaser.Tilemaps.Tileset[] = [];

      // Add all the tilesets
      this.map.tilesets.forEach((tileset) => {
        const tilesetName = tileset.name;
        const tilesetImage = this.map?.addTilesetImage(tilesetName, tilesetName);

        if (tilesetImage) {
          tilesetImages.push(tilesetImage);
        } else {
          console.warn(`Failed to add tileset: ${tilesetName}`);
        }
      });

      // Check if we have any valid tilesets
      if (tilesetImages.length === 0) {
        console.error("No valid tilesets found for the map");
        return false;
      }

      // Create all layers using all tilesets
      this.map.layers.forEach((layerData) => {
        const layer = this.map?.createLayer(layerData.name, tilesetImages);

        if (!layer) return;

        // Store references to important layers
        if (layerData.name === "ground-layer") {
          this.groundLayer = layer;
        } else if (layerData.name === "wall-layer") {
          this.collisionLayer = layer;
        } else if (layerData.name === "chest-layer") {
          this.chestLayer = layer;
        } else if (layerData.name === "collision-layer") {
          // This is our dedicated collision layer
          this.collisionLayer = layer;

          // Set collision for ALL non-empty tiles in this layer
          layer.setCollisionByExclusion([-1]);

          // Make collision layer invisible in game
          layer.setVisible(false);
        }

        layer.setPosition(0, 0);
      });

      // Process object layers
      if (this.map) {
        // Get the interact layer (which is an object layer, not a tile layer)
        this.interactLayer = this.map.getObjectLayer("interact-layer");
      }

      // Set physics bounds to match the visible area
      if (this.groundLayer) {
        this.physics.world.setBounds(
          0,
          0,
          this.groundLayer.displayWidth,
          this.groundLayer.displayHeight
        );
      }

      return true;
    } catch (error) {
      console.error("Error in GameScene.loadTiledMap:", error);
      eventBus.emit("ui.message.show", "Error loading map. Check console for details.");
      return false;
    }
  }

  changeMap(mapKey: string, destX: number, destY: number, message?: string): void {
    try {
      // Prevent double transitions
      if (this.isChangingMap) return;
      this.isChangingMap = true;

      console.log(`Starting map change to: ${mapKey}`);

      // Update the game state
      useGameStore.getState().updatePlayerMap(mapKey);

      // Fade out camera
      this.cameras.main.fadeOut(300, 0, 0, 0);

      this.cameras.main.once("camerafadeoutcomplete", () => {
        try {
          // Cleanup current map resources
          this.cleanupCurrentMap();

          // Load the new map
          this.loadTiledMap();

          // Set up new collisions
          this.setupCollisions();

          // IMPORTANT: Re-initialize game systems for the new map
          this.reinitializeSystemsForNewMap();

          // Reposition the player
          if (this.playerCharacter) {
            this.playerCharacter.setPosition(destX, destY);

            // Reset physics body to avoid any collision issues
            if (this.playerCharacter.body) {
              this.playerCharacter.body.reset(destX, destY);
            }

            // Center camera on player immediately to avoid jerky movement
            this.cameras.main.centerOn(destX, destY);
          }

          // Refresh UI components to ensure they're visible
          this.refreshUIComponents();

          // Fade back in
          this.cameras.main.fadeIn(300, 0, 0, 0);

          // Reset the flag when fade-in is complete
          this.cameras.main.once("camerafadeincomplete", () => {
            this.finalizeMapTransition();

            this.isChangingMap = false;
            console.log("Map transition completed successfully");

            // Add notification about the location change
            const displayMessage = message || `Entered ${MapService.getMapName(mapKey)}`;
            eventBus.emit("ui.message.show", displayMessage);

            // Emit map changed event AFTER everything is set up
            eventBus.emit("map.changed", mapKey);
          });
        } catch (error) {
          // Make sure to reset the flag even if there's an error
          this.isChangingMap = false;
          console.error("Error in map transition:", error);
        }
      });
    } catch (error) {
      this.isChangingMap = false;
      console.error("Error in GameScene.changeMap:", error);
    }
  }

  /**
   * Re-initialize systems that need to be reset for the new map
   */
  private reinitializeSystemsForNewMap(): void {
    try {
      const store = useGameStore.getState();

      // FIXED: Create completely fresh ItemHoverSystem for new map
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }
      this.itemHoverSystem = new ItemHoverSystem();
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);
      this.itemHoverSystem.setupGlobalPointerHandler(this);

      // Re-initialize portal system for the new map
      this.initPortalSystem();

      this.spawnInitialMonsters();

      // Re-initialize cursor position system
      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }
      this.initCursorPositionSystem();

      // Re-setup input handlers
      this.input.keyboard?.off("keydown-E");
      this.input.keyboard?.on("keydown-E", () => {
        if (this.playerCharacter) {
          this.playerCharacter.pickupNearbyItem();
        }
      });
    } catch (error) {
      console.error("Error re-initializing systems for new map:", error);
    }
  }

  /**
   * Final setup after map transition is completely done
   */
  private finalizeMapTransition(): void {
    try {
      if (this.itemHoverSystem) {
        // Give it a moment for items to be fully spawned
        this.time.delayedCall(100, () => {
          if (this.itemHoverSystem) {
            this.itemHoverSystem.cleanup();
            this.itemHoverSystem = new ItemHoverSystem();
            useGameStore.getState().registerSystem("itemHoverSystem", this.itemHoverSystem);
            this.itemHoverSystem.setupGlobalPointerHandler(this);
          }
        });
      }
    } catch (error) {
      console.error("Error finalizing map transition:", error);
    }
  }

  /**
   * Cleans up resources from the current map before loading a new one
   */
  private cleanupCurrentMap(): void {
    try {
      // Clean up ItemHoverSystem first
      if (this.itemHoverSystem) {
        console.log("Cleaning up ItemHoverSystem during map change");
        this.itemHoverSystem.cleanup();
      }

      // Clean up portal system
      if (this.portalSystem) {
        console.log("Cleaning up PortalSystem during map change");
        this.portalSystem.cleanup();
      }

      // Pause physics to prevent collision errors during the transition
      this.physics.pause();

      // Remove all colliders
      this.physics.world.colliders.destroy();

      // Destroy tilemap layers
      if (this.map) {
        const allLayers = this.map.layers;
        allLayers.forEach((layerData) => {
          if (layerData.tilemapLayer) {
            layerData.tilemapLayer.destroy(true);
          }
        });

        // Clean up layer references
        this.groundLayer = undefined;
        this.collisionLayer = undefined;
        this.chestLayer = undefined;
        this.interactLayer = null;

        // Destroy the map itself
        this.map.destroy();
        this.map = undefined;
      }

      // Clear groups
      if (this.items) {
        this.items.clear(true, true);
      }
      if (this.monsters) {
        this.monsters.clear(true, true);
      }
      if (this.npcs) {
        this.npcs.clear(true, true);
      }
      if (this.chests) {
        this.chests.clear(true, true);
      }

      // Clean up cursor position system
      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }

      // Resume physics
      this.physics.resume();

      console.log("Map cleanup completed");
    } catch (error) {
      console.error("Error in GameScene.cleanupCurrentMap:", error);
    }
  }

  /**
   * Refresh UI components after map change
   */
  private refreshUIComponents(): void {
    try {
      // Refresh player character UI components
      if (this.playerCharacter && typeof this.playerCharacter.refreshUIComponents === "function") {
        this.playerCharacter.refreshUIComponents();
      }
    } catch (error) {
      console.error("Error refreshing UI components:", error);
    }
  }

  // =============================================================================
  // COLLISION SETUP
  // =============================================================================

  setupCollisions(): void {
    try {
      if (!this.collisionLayer || !this.playerCharacter) return;

      // Basic collisions
      this.physics.add.collider(this.playerCharacter, this.collisionLayer);
      this.physics.add.collider(this.items, this.collisionLayer);
      this.physics.add.collider(this.monsters, this.collisionLayer);
      this.physics.add.collider(this.npcs, this.collisionLayer);
      this.physics.add.collider(this.chests, this.collisionLayer);
      this.physics.add.collider(this.monsters, this.playerCharacter);

      // NPC interaction
      this.physics.add.overlap(this.playerCharacter, this.npcs, (player, npc) => {
        const isInteractKeyDown = this.input.keyboard?.checkDown(
          this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
          500
        );
        if (isInteractKeyDown) {
          (npc as NPC).interact();
        }
      });
    } catch (error) {
      console.error("Error in GameScene.setupCollisions:", error);
    }
  }

  // =============================================================================
  // ENTITY SPAWNING
  // =============================================================================

  spawnInitialMonsters(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (currentMap === "game-map") {
        this.spawnMonster("decayed-skeleton", 1, 0);
        this.spawnMonster("dark-elf-mage", 400, 950);
        this.spawnMonster("dark-elf-archer", 400, 1000);
        this.spawnMonster("dark-elf-knight", 300, 700);
      }
    } catch (error) {
      console.error("Error in GameScene.spawnInitialMonsters:", error);
    }
  }

  private spawnInitialNPCs(): void {
    try {
      // Get the current map from the store
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Only spawn NPCs for the game-map
      if (currentMap === "game-map") {
        // Spawn Al Dee - merchant NPC
        const alDeeData = NPCService.getNPC("merchant-aldee");
        if (alDeeData) {
          this.spawnNPC(alDeeData, 2128, 1328);
          console.log("Spawned Al Dee at (2128, 1328)");
        }
      }
    } catch (error) {
      console.error("Error in GameScene.spawnInitialNPCs:", error);
      eventBus.emit("ui.error.show", `Error spawning NPCs: ${(error as Error).message}`);
    }
  }

  /**
   * Spawn test items to verify hover system works after map changes
   */
  private spawnTestItems(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Spawn test items on each map
      if (currentMap === "game-map") {
        this.spawnItem("fireSword", 1584, 240);
      }
    } catch (error) {
      console.error("Error spawning test items:", error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  initCursorPositionSystem(): void {
    try {
      // Create the cursor position system with the current scene and tile size
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);
      this.cursorPositionSystem.initialize();
    } catch (error) {
      console.error("Error in GameScene.initCursorPositionSystem:", error);
    }
  }

  // =============================================================================
  // ENTITY CREATION METHODS
  // =============================================================================

  spawnItem(
    templateId: string,
    x: number,
    y: number,
    instanceId?: string,
    bonusStats?: ItemBonusStats
  ): Item | null {
    try {
      // Make sure instanceId is a string if provided, or undefined will be used
      const item = new Item(this, x, y, templateId, instanceId || undefined, bonusStats);
      this.items.add(item);

      // Emit item spawned event
      eventBus.emit("item.spawned", {
        templateId,
        instanceId: item.instanceId,
        position: { x, y },
      });

      return item;
    } catch (error) {
      console.error(`Error spawning item ${templateId}:`, error);
      return null;
    }
  }

  spawnMonster(monsterType: string, x: number, y: number, id?: string): Monster | null {
    try {
      // If id is provided, use it, otherwise let Monster generate one
      const monster = id
        ? new Monster(this, x, y, monsterType, id)
        : new Monster(this, x, y, monsterType);
      this.monsters.add(monster);

      // Emit monster spawned event
      eventBus.emit("monster.spawned", {
        id: monster.id,
        type: monsterType,
        position: { x, y },
      });

      return monster;
    } catch (error) {
      console.error(`Error spawning monster ${monsterType}:`, error);
      return null;
    }
  }

  spawnNPC(npcData: NPCData, x: number, y: number): NPC | null {
    try {
      const npc = new NPC(this, x, y, npcData);
      this.npcs.add(npc);

      // Emit NPC spawned event
      eventBus.emit("npc.spawned", {
        id: npc.id,
        name: npc.npcName,
        position: { x, y },
      });

      return npc;
    } catch (error) {
      console.error(`Error spawning NPC ${npcData.id}:`, error);
      return null;
    }
  }

  spawnChest(id: string, x: number, y: number, lootTable: string = "default"): Chest | null {
    try {
      const chest = new Chest(this, x, y, id, lootTable);
      this.chests.add(chest);

      // Emit chest spawned event
      eventBus.emit("chest.spawned", {
        id,
        lootTable,
        position: { x, y },
      });

      return chest;
    } catch (error) {
      console.error(`Error spawning chest ${id}:`, error);
      return null;
    }
  }
}
