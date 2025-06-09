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

interface GameSceneExtras {
  playerCharacter: PlayerCharacter;
  items: Phaser.GameObjects.Group;
  monsters: Phaser.GameObjects.Group;
  npcs: Phaser.GameObjects.Group;
  chests: Phaser.GameObjects.Group;
}

export class GameScene extends Phaser.Scene implements GameSceneExtras {
  declare playerCharacter: PlayerCharacter;
  declare items: Phaser.GameObjects.Group;
  declare monsters: Phaser.GameObjects.Group;
  declare npcs: Phaser.GameObjects.Group;
  declare chests: Phaser.GameObjects.Group;
  itemHoverSystem?: ItemHoverSystem;
  cursorPositionSystem!: CursorPositionSystem;
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

      // Create item, monster, and NPC groups
      this.items = this.add.group();
      this.monsters = this.add.group();
      this.npcs = this.add.group();
      this.chests = this.add.group();

      // Determine player spawn position
      let startX: number;
      let startY: number;

      // Check if we have teleport coordinates from a map transition
      if (store.playerCharacter.teleportPosition) {
        startX = store.playerCharacter.teleportPosition.x;
        startY = store.playerCharacter.teleportPosition.y;

        // Clear the teleport position after using it
        delete store.playerCharacter.teleportPosition;
      }
      // Otherwise use default positions for the current map
      else {
        const currentMap = store.currentMap;
        const defaultSpawn = MapService.getDefaultSpawn(currentMap);
        startX = defaultSpawn.x;
        startY = defaultSpawn.y;
      }

      // Create the player character at the determined position
      this.playerCharacter = new PlayerCharacter(this, startX, startY);

      // Set up camera to follow playerCharacter
      this.cameras.main.startFollow(
        this.playerCharacter,
        true, // roundPixels
        100, // lerpX
        100, // lerpY
        0, // offsetX
        0 // offsetY
      );
      this.cameras.main.setZoom(1.4);

      // Fade in when the scene starts
      this.cameras.main.fadeIn(500, 0, 0, 0);

      // Setup game systems
      this.setupCollisions();
      this.initializeGameSystems();

      // Setup E key handler for item pickup
      this.input.keyboard?.on("keydown-E", () => {
        if (this.playerCharacter) {
          this.playerCharacter.pickupNearbyItem();
        }
      });

      // Spawn initial monsters
      this.spawnInitialMonsters();

      // Spawn NPCs
      this.spawnInitialNPCs();

      this.spawnTestItems();

      // Emit game scene ready event
      eventBus.emit("game.scene.ready", { scene: this });
    } catch (error) {
      console.error("Error in GameScene.create:", error);
      eventBus.emit("ui.error.show", `Error creating game scene: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize all game systems - extracted into separate method for reuse
   */
  private initializeGameSystems(): void {
    try {
      const store = useGameStore.getState();

      // FIXED: Always create a fresh ItemHoverSystem for map changes
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }
      this.itemHoverSystem = new ItemHoverSystem();
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);

      // Setup the pointer handler for the current scene
      this.itemHoverSystem.setupGlobalPointerHandler(this);

      // Register the game scene in the store
      store.registerSystem("gameScene", this);

      // Reset the auto attack system and register it
      autoAttackSystem.initialize();
      store.registerSystem("autoAttackSystem", autoAttackSystem);

      // Initialize cursor position display system
      this.initCursorPositionSystem();

      console.log("Game systems initialized successfully");
    } catch (error) {
      console.error("Error initializing game systems:", error);
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

  spawnInitialMonsters(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (currentMap === "noob-cave-map") {
        this.spawnMonster("decayed-skeleton", 400, 800);
        this.spawnMonster("dark-elf-mage", 400, 950);
        this.spawnMonster("dark-elf-archer", 400, 1000);
        this.spawnMonster("dark-elf-knight", 300, 700);
      }
    } catch (error) {
      console.error("Error in GameScene.spawnInitialMonsters:", error);
    }
  }

  initCursorPositionSystem(): void {
    try {
      // Create the cursor position system with the current scene and tile size
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);
      this.cursorPositionSystem.initialize();
    } catch (error) {
      console.error("Error in GameScene.initCursorPositionSystem:", error);
    }
  }

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

  setupCollisions(): void {
    try {
      // PlayerCharacter collides with map elements
      if (this.collisionLayer && this.playerCharacter) {
        this.physics.add.collider(this.playerCharacter, this.collisionLayer);
      }

      // Items collide with collision layer
      if (this.items && this.collisionLayer) {
        this.physics.add.collider(this.items, this.collisionLayer);
      }

      // Monsters collide with collision layer
      if (this.monsters && this.collisionLayer) {
        this.physics.add.collider(this.monsters, this.collisionLayer);
      }

      // Monsters collide with player
      if (this.monsters && this.playerCharacter) {
        this.physics.add.collider(this.monsters, this.playerCharacter);
      }

      // NPCs collide with collision layer
      if (this.npcs && this.collisionLayer) {
        this.physics.add.collider(this.npcs, this.collisionLayer);
      }

      // Chests collide with collision layer
      if (this.chests && this.collisionLayer) {
        this.physics.add.collider(this.chests, this.collisionLayer);
      }

      // Player can overlap with NPCs for interaction
      if (this.npcs && this.playerCharacter) {
        this.physics.add.overlap(this.playerCharacter, this.npcs, (player, npc) => {
          // Check if player is pressing the interaction key
          const isInteractKeyDown = this.input.keyboard?.checkDown(
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            500
          );

          if (isInteractKeyDown) {
            (npc as NPC).interact();
          }
        });
      }
    } catch (error) {
      console.error("Error in GameScene.setupCollisions:", error);
    }
  }

  /**
   * Changes the current map without restarting the scene
   * @param mapKey The key of the new map to load
   * @param destX Destination X coordinate for the player
   * @param destY Destination Y coordinate for the player
   * @param message Optional message to display when entering the map
   */
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
          this.itemHoverSystem!.cleanup();
          this.itemHoverSystem = new ItemHoverSystem();
          useGameStore.getState().registerSystem("itemHoverSystem", this.itemHoverSystem);
          this.itemHoverSystem!.setupGlobalPointerHandler(this);
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

  spawnItem(
    templateId: string,
    x: number,
    y: number,
    instanceId?: string,
    bonusStats?: ItemBonusStats
  ): Item | null {
    try {
      // If no instanceId is provided, always create a new instance
      if (!instanceId) {
        // For world drops, 20% chance of random bonus stats
        if (Math.random() < 0.2) {
          const instance = ItemInstanceManager.createRandomInstance(templateId);
          instanceId = instance.instanceId;
          bonusStats = instance.bonusStats;
        } else {
          const instance = ItemInstanceManager.createItemInstance(templateId);
          instanceId = instance.instanceId;
        }
      }

      const item = new Item(this, x, y, templateId, instanceId, bonusStats);
      this.items.add(item);

      // Set up overlap with player
      if (this.playerCharacter) {
        this.physics.add.overlap(this.playerCharacter, item, () => {
          if (!this.playerCharacter.nearbyItems.includes(item)) {
            this.playerCharacter.addNearbyItem(item);
            if (item.highlightItem) item.highlightItem();
          }
        });
      }

      return item;
    } catch (error) {
      console.error("Error in GameScene.spawnItem:", error);
      return null;
    }
  }

  spawnMonster(monsterType: string, x: number, y: number): Monster | null {
    try {
      const monster = new Monster(this, x, y, monsterType);
      this.monsters.add(monster);

      // Initialize monster with a default animation
      // Use the animation system to play the idle animation
      monster.playAnimation("down", false);

      // Let the player know a monster has appeared
      eventBus.emit("ui.message.show", `A ${monster.monsterName} has appeared!`);

      return monster;
    } catch (error) {
      console.error("Error in GameScene.spawnMonster:", error);
      return null;
    }
  }

  /**
   * Spawns an NPC at the specified position
   * @param npcData The NPC data
   * @param x X coordinate
   * @param y Y coordinate
   * @returns The spawned NPC
   */
  spawnNPC(npcData: NPCData, x: number, y: number): NPC | null {
    try {
      const npc = new NPC(this, x, y, npcData);
      this.npcs.add(npc);

      // Initialize with a default animation
      npc.playAnimation("down", false);

      // Return the created NPC
      return npc;
    } catch (error) {
      console.error("Error in GameScene.spawnNPC:", error);
      return null;
    }
  }

  update(time: number, delta: number): void {
    try {
      // Skip updates while changing maps to avoid issues
      if (this.isChangingMap) return;

      // Update playerCharacter
      if (this.playerCharacter && this.playerCharacter.active) {
        this.playerCharacter.update(time);

        // Ensure camera follows smoothly by updating every frame
        this.cameras.main.scrollX = Phaser.Math.Linear(
          this.cameras.main.scrollX,
          this.playerCharacter.x - this.cameras.main.width / 2,
          0.08
        );
        this.cameras.main.scrollY = Phaser.Math.Linear(
          this.cameras.main.scrollY,
          this.playerCharacter.y - this.cameras.main.height / 2,
          0.08
        );
      }

      // Get systems from the store
      const store = useGameStore.getState();
      const systems = store.systems || {};

      // Update auto attack if available
      if (systems.autoAttackSystem) {
        // Call the auto attack system update with a direct reference to this scene
        systems.autoAttackSystem.update();
      }

      // Update items
      if (this.items) {
        this.items.getChildren().forEach((item) => {
          if ((item as Item).update) {
            (item as Item).update();
          }
        });
      }

      // Update monsters
      if (this.monsters) {
        this.monsters.getChildren().forEach((gameObject) => {
          const monster = gameObject as Monster;
          if (monster.active && monster.update) {
            monster.update(time, delta);
          }
        });
      }

      // Update NPCs
      if (this.npcs) {
        this.npcs.getChildren().forEach((gameObject) => {
          const npc = gameObject as NPC;
          if (npc.active && npc.update) {
            npc.update(time, delta);
          }
        });
      }

      // Update chests
      if (this.chests) {
        this.chests.getChildren().forEach((gameObject) => {
          const chest = gameObject as Chest;
          if (chest.active && chest.update) {
            chest.update(time, delta);
          }
        });
      }
    } catch (error) {
      console.error("Error in GameScene.update:", error);
    }
  }

  destroy() {
    try {
      // Clean up item hover system
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }

      // Clean up cursor position system
      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }

      // Remove key listeners
      if (this.input?.keyboard) {
        this.input.keyboard.off("keydown-E");
      }
    } catch (error) {
      console.error("Error in GameScene.destroy:", error);
    }
  }
}
