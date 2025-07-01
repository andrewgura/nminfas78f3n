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
import { ItemBonusStats, ItemCategory, ItemData } from "@/types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { autoAttackSystem } from "@/services/AutoAttackSystem";
import { NPCService } from "@/services/NPCService";
import { PortalSystem } from "@/services/PortalSystem";
import { MonsterSpawnSystem } from "@/services/MonsterSpawnSystem";
import { Chest } from "@/entities/Chest";
import { ChestLootTables } from "@/data/chest-loot-tables";
import { ItemDictionary } from "@/services/ItemDictionaryService";

// Chest state interface
interface ChestState {
  id: string;
  isOpen: boolean;
  lootTable: string;
  respawnTime: number;
  chestSprite: Chest;
  x: number;
  y: number;
  respawnTimer?: Phaser.Time.TimerEvent;
}

export class GameScene extends Phaser.Scene {
  declare playerCharacter: PlayerCharacter;
  declare items: Phaser.GameObjects.Group;
  declare monsters: Phaser.GameObjects.Group;
  declare npcs: Phaser.GameObjects.Group;
  declare chests: Phaser.GameObjects.Group;

  itemHoverSystem?: ItemHoverSystem;
  cursorPositionSystem!: CursorPositionSystem;
  portalSystem?: PortalSystem;
  monsterSpawnSystem?: MonsterSpawnSystem;
  map?: Phaser.Tilemaps.Tilemap;
  groundLayer?: Phaser.Tilemaps.TilemapLayer;
  interactLayer?: Phaser.Tilemaps.ObjectLayer | null;
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  isChangingMap: boolean = false;

  // Chest state management
  private chestStates: Map<string, ChestState> = new Map();

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

      // Create item, monster, NPC, and chest groups
      this.createGameGroups();

      // Initialize chests from interact-layer
      this.initializeChests();

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

  // =============================================================================
  // INITIALIZATION METHODS
  // =============================================================================

  private createGameGroups(): void {
    try {
      // Create groups for game entities
      this.items = this.add.group();
      this.monsters = this.add.group();
      this.npcs = this.add.group();
      this.chests = this.add.group();
    } catch (error) {
      console.error("Error creating game groups:", error);
      eventBus.emit("ui.error.show", `Error creating game groups: ${(error as Error).message}`);
    }
  }

  private setupCamera(): void {
    try {
      // Set up camera to follow playerCharacter
      this.cameras.main.startFollow(
        this.playerCharacter,
        true, // roundPixels
        100, // lerpX
        100, // lerpY
        0, // offsetX
        0 // offsetY
      );
      this.cameras.main.setZoom(1.7);

      // Fade in when the scene starts
      this.cameras.main.fadeIn(500, 0, 0, 0);
    } catch (error) {
      console.error("Error setting up camera:", error);
    }
  }

  private initializeGameSystems(): void {
    try {
      const store = useGameStore.getState();

      // Initialize systems
      this.itemHoverSystem = new ItemHoverSystem();
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);

      // Initialize monster spawn system
      this.monsterSpawnSystem = new MonsterSpawnSystem(this);
      this.monsterSpawnSystem.initialize();

      // Register systems
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);
      store.registerSystem("gameScene", this);
      store.registerSystem("autoAttackSystem", autoAttackSystem);
      store.registerSystem("monsterSpawnSystem", this.monsterSpawnSystem);

      // Setup systems
      this.itemHoverSystem.setupGlobalPointerHandler(this);
      this.cursorPositionSystem.initialize();
      autoAttackSystem.initialize();

      // Initialize portal system for stair/teleport functionality
      this.initPortalSystem();

      // Setup collisions
      this.setupCollisions();
    } catch (error) {
      console.error("Error initializing game systems:", error);
    }
  }

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
    this.spawnInitialNPCs();
    this.spawnTestItems();
    // Monster spawning is now handled by MonsterSpawnSystem
  }

  // =============================================================================
  // CHEST SYSTEM METHODS
  // =============================================================================

  private initializeChests(): void {
    try {
      if (!this.interactLayer) {
        console.warn("No interact layer found for chest initialization");
        return;
      }

      // Clear existing chest states
      this.chestStates.clear();

      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Find all chest interaction objects and spawn them as sprites
      this.interactLayer.objects.forEach((obj: any) => {
        if (obj.properties && obj.x !== undefined && obj.y !== undefined) {
          let chestId = "";
          let lootTable = "default";
          let respawnTime = 300;
          let chestType = "chest-closed";

          // Parse properties
          obj.properties.forEach((prop: any) => {
            if (prop.name === "id") chestId = prop.value;
            if (prop.name === "lootTable") lootTable = prop.value;
            if (prop.name === "respawnTime") respawnTime = parseInt(prop.value, 10) || 300;
            if (prop.name === "chestType") chestType = prop.value;
          });

          // If this object has a chest ID, spawn a chest sprite
          if (chestId) {
            // Better coordinate conversion for Tiled objects
            // Tiled objects have their origin at top-left, but we want center positioning
            const objCenterX = obj.x + (obj.width || 32) / 2;
            const objCenterY = obj.y + (obj.height || 32) / 2;

            // Convert pixel coordinates to tile coordinates
            const tileX = Math.floor(objCenterX / 32);
            const tileY = Math.floor(objCenterY / 32);

            // Use MapService to convert tile coordinates to proper Phaser world coordinates
            const phaserCoords = MapService.tiledToPhaser(currentMap, tileX, tileY);

            const chest = this.spawnChest(
              chestId,
              phaserCoords.x,
              phaserCoords.y,
              lootTable,
              respawnTime,
              chestType
            );

            if (chest) {
              // Store the tile coordinates in the chest for interaction checking
              (chest as any).tileX = tileX;
              (chest as any).tileY = tileY;
            }
          }
        }
      });
    } catch (error) {
      console.error("Error initializing chests:", error);
    }
  }

  spawnChest(
    chestId: string,
    x: number,
    y: number,
    lootTable: string = "default",
    respawnTime: number = 300,
    chestType: string = "chest-closed"
  ): Chest | null {
    try {
      // Check if chest with this ID already exists
      const existingChest = Array.from(this.chestStates.values()).find(
        (state) => state.id === chestId
      );

      if (existingChest) {
        console.warn(`Chest with ID ${chestId} already exists, skipping spawn`);
        return existingChest.chestSprite;
      }

      // Create the chest entity
      const chest = new Chest(this, x, y, chestId, lootTable, respawnTime);
      chest.setTexture(chestType);

      // Add to chests group
      this.chests.add(chest);

      // Create chest state for tracking
      const chestState: ChestState = {
        id: chestId,
        isOpen: false,
        lootTable,
        respawnTime,
        chestSprite: chest,
        x: x,
        y: y,
      };

      this.chestStates.set(chestId, chestState);

      return chest;
    } catch (error) {
      console.error("Error spawning chest:", error);
      return null;
    }
  }

  public canOpenChestAtTile(tileX: number, tileY: number): Chest | null {
    // First, check if there's an interact-layer object at this tile position
    if (!this.interactLayer) {
      return null;
    }

    let chestAtTile: Chest | null = null;

    // Find interact-layer object at this tile position
    this.interactLayer.objects.forEach((obj: any) => {
      if (obj.properties) {
        let hasChestId = false;

        // Check if this object has chest properties
        obj.properties.forEach((prop: any) => {
          if (prop.name === "id" && prop.value) {
            hasChestId = true;
          }
        });

        if (hasChestId) {
          // Calculate the tile position of this object
          const objCenterX = obj.x + (obj.width || 32) / 2;
          const objCenterY = obj.y + (obj.height || 32) / 2;
          const objTileX = Math.floor(objCenterX / 32);
          const objTileY = Math.floor(objCenterY / 32);

          // Check if this matches the target tile
          if (objTileX === tileX && objTileY === tileY) {
            // Find the corresponding chest sprite
            for (const chestState of this.chestStates.values()) {
              const chest = chestState.chestSprite;
              if (
                chest &&
                (chest as any).tileX === tileX &&
                (chest as any).tileY === tileY &&
                !chestState.isOpen
              ) {
                chestAtTile = chest;
                break;
              }
            }
          }
        }
      }
    });

    return chestAtTile;
  }

  public openChest(chest: Chest): boolean {
    const chestState = Array.from(this.chestStates.values()).find(
      (state) => state.chestSprite === chest
    );

    if (!chestState || chestState.isOpen) {
      return false;
    }

    try {
      // Mark chest as open
      chestState.isOpen = true;

      // Hide the chest sprite immediately
      chest.setVisible(false);
      chest.setActive(false);

      // Generate loot at chest position using the updated ChestLootTables
      // Now properly passing the quantity parameter to spawnItem
      ChestLootTables.generateLootFromTable(
        chestState.lootTable,
        chest.x,
        chest.y,
        (itemId: string, x: number, y: number, quantity?: number) => {
          // Pass all parameters including quantity to spawnItem
          this.spawnItem(itemId, x, y, undefined, undefined, quantity);
        }
      );

      // Schedule respawn
      this.scheduleChestRespawn(chestState);

      eventBus.emit("ui.message.show", `You found a treasure chest!`);

      return true;
    } catch (error) {
      console.error("Error opening chest:", error);
      return false;
    }
  }

  private scheduleChestRespawn(chestState: ChestState): void {
    try {
      // Clear any existing respawn timer
      if (chestState.respawnTimer) {
        chestState.respawnTimer.destroy();
      }

      // Create new respawn timer
      chestState.respawnTimer = this.time.delayedCall(
        chestState.respawnTime * 1000, // Convert seconds to milliseconds
        () => {
          // Respawn the chest
          chestState.isOpen = false;
          chestState.chestSprite.setVisible(true);
          chestState.chestSprite.setActive(true);
          chestState.chestSprite.setTexture("chest-closed");

          eventBus.emit("ui.message.show", "A chest has respawned nearby!");
        }
      );
    } catch (error) {
      console.error("Error scheduling chest respawn:", error);
    }
  }

  private cleanupChests(): void {
    try {
      // Clear all chest respawn timers
      this.chestStates.forEach((chestState) => {
        if (chestState.respawnTimer) {
          chestState.respawnTimer.destroy();
        }
      });

      // Clear chest states
      this.chestStates.clear();

      // Clear chest group
      if (this.chests) {
        this.chests.clear(true, true);
      }
    } catch (error) {
      console.error("Error cleaning up chests:", error);
    }
  }

  // =============================================================================
  // CHEST DEBUG METHODS
  // =============================================================================

  public debugChestPositions(): void {
    this.chestStates.forEach((chestState, chestId) => {
      const chest = chestState.chestSprite;
    });

    if (this.interactLayer) {
      this.interactLayer.objects.forEach((obj: any, index: number) => {
        if (obj.properties) {
          const hasChestId = obj.properties.some((prop: any) => prop.name === "id");
          if (hasChestId) {
          }
        }
      });
    }
  }

  public testChestInteraction(tileX: number, tileY: number): void {
    const chest = this.canOpenChestAtTile(tileX, tileY);
    if (chest) {
      this.openChest(chest);
    } else {
      console.log("No chest found at this tile");
    }
  }

  // =============================================================================
  // MAP AND TILEMAP METHODS
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

  private analyzeMapChunks(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      // Import the MapChunkCalculator dynamically in development
      import("../utils/MapChunkCalculator")
        .then(({ MapChunkCalculator }) => {
          const analysis = MapChunkCalculator.analyzeTiledMap(currentMap, this);

          if (analysis) {
            // Compare with current configuration
            MapService.getMap(currentMap);
          }
        })
        .catch((err) => {
          console.log("MapChunkCalculator not available:", err.message);
        });
    } catch (error) {
      console.log("Map chunk analysis not available:", error);
    }
  }

  // =============================================================================
  // ENTITY SPAWNING METHODS
  // =============================================================================

  spawnItem(
    templateId: string,
    x: number,
    y: number,
    instanceId?: string,
    bonusStats?: ItemBonusStats,
    quantity?: number
  ): Item | null {
    try {
      // If no instanceId is provided, always create a new instance
      if (!instanceId) {
        // Check if this item type should be eligible for bonus stats
        const itemData = ItemDictionary.getItem(templateId);
        const shouldGetBonusStats = this.isEligibleForBonusStats(itemData);

        // For equipment items dropped in the world, 20% chance of random bonus stats
        if (shouldGetBonusStats && Math.random() < 0.2) {
          const instance = ItemInstanceManager.createRandomInstance(templateId, quantity);
          instanceId = instance.instanceId;
          bonusStats = instance.bonusStats;
          quantity = instance.quantity;
        } else {
          const instance = ItemInstanceManager.createItemInstance(templateId, bonusStats, quantity);
          instanceId = instance.instanceId;
          quantity = instance.quantity;
        }
      }

      const item = new Item(this, x, y, templateId, instanceId, bonusStats, quantity);
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

  private isEligibleForBonusStats(itemData: ItemData | null): boolean {
    if (!itemData || !itemData.category) return false;

    // Only equipment items should be eligible for bonus stats
    const equipmentCategories = [
      ItemCategory.WEAPON_MELEE,
      ItemCategory.WEAPON_MAGIC,
      ItemCategory.WEAPON_RANGED,
      ItemCategory.ARMOR,
      ItemCategory.SHIELD,
      ItemCategory.HELMET,
      ItemCategory.AMULET,
      ItemCategory.TRINKET,
    ];

    return equipmentCategories.includes(itemData.category);
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
        }
      }
    } catch (error) {
      console.error("Error in GameScene.spawnInitialNPCs:", error);
      eventBus.emit("ui.error.show", `Error spawning NPCs: ${(error as Error).message}`);
    }
  }

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
  // COLLISION AND PHYSICS METHODS
  // =============================================================================

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

  // =============================================================================
  // MAP TRANSITION METHODS
  // =============================================================================

  changeMap(mapKey: string, destX: number, destY: number, message?: string): void {
    try {
      // Prevent double transitions
      if (this.isChangingMap) return;
      this.isChangingMap = true;

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

          // Initialize chests for the new map
          this.initializeChests();

          // Set up new collisions
          this.setupCollisions();

          // Re-initialize game systems for the new map
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

            // Add notification about the location change
            const displayMessage = message || `Entered ${MapService.getMapName(mapKey)}`;
            eventBus.emit("ui.message.show", displayMessage);

            // Emit map changed event AFTER everything is set up
            eventBus.emit("map.changed", mapKey);
          });
        } catch (error) {
          console.error("Error during map transition:", error);
          this.isChangingMap = false;
          eventBus.emit("ui.error.show", "Error during map transition");
        }
      });
    } catch (error) {
      console.error("Error in changeMap:", error);
      this.isChangingMap = false;
      eventBus.emit("ui.error.show", "Error changing map");
    }
  }

  private finalizeMapTransition(): void {
    try {
      // Re-setup ItemHoverSystem after map transition
      if (this.itemHoverSystem) {
        setTimeout(() => {
          this.itemHoverSystem!.setupGlobalPointerHandler(this);
        }, 100);
      }
    } catch (error) {
      console.error("Error finalizing map transition:", error);
    }
  }

  private cleanupCurrentMap(): void {
    try {
      // Clean up chest timers before clearing states
      this.cleanupChests();

      // Clean up MonsterSpawnSystem first
      if (this.monsterSpawnSystem) {
        this.monsterSpawnSystem.cleanup();
      }

      // Clean up ItemHoverSystem first
      if (this.itemHoverSystem) {
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
    } catch (error) {
      console.error("Error in GameScene.cleanupCurrentMap:", error);
    }
  }

  private reinitializeSystemsForNewMap(): void {
    try {
      const store = useGameStore.getState();

      // Clean up and reinitialize ItemHoverSystem
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }
      this.itemHoverSystem = new ItemHoverSystem();
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);

      // Reinitialize monster spawn system for new map
      if (this.monsterSpawnSystem) {
        this.monsterSpawnSystem.cleanup();
        this.monsterSpawnSystem.initialize();
      }

      // Reinitialize portal system
      this.initPortalSystem();

      // Reinitialize cursor position system
      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);
      this.cursorPositionSystem.initialize();
    } catch (error) {
      console.error("Error reinitializing systems for new map:", error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

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
  // CLEANUP
  // =============================================================================

  destroy(): void {
    try {
      // Clean up chest timers
      this.cleanupChests();

      // Cleanup monster spawn system
      if (this.monsterSpawnSystem) {
        this.monsterSpawnSystem.destroy();
      }

      // Cleanup other systems
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }

      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }

      if (this.portalSystem) {
        this.portalSystem.cleanup();
      }

      // Remove key listeners
      if (this.input?.keyboard) {
        this.input.keyboard.off("keydown-E");
      }
    } catch (error) {
      console.error("Error destroying GameScene:", error);
    }
  }
}
