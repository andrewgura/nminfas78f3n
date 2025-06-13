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

export class GameScene extends Phaser.Scene {
  declare playerCharacter: PlayerCharacter;
  declare items: Phaser.GameObjects.Group;
  declare monsters: Phaser.GameObjects.Group;
  declare npcs: Phaser.GameObjects.Group;
  declare chests: Phaser.GameObjects.Group;

  itemHoverSystem?: ItemHoverSystem;
  cursorPositionSystem!: CursorPositionSystem;
  map?: Phaser.Tilemaps.Tilemap;
  groundLayer?: Phaser.Tilemaps.TilemapLayer;
  collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  isChangingMap: boolean = false;

  constructor() {
    super({ key: "game" });
  }

  create(): void {
    try {
      const store = useGameStore.getState();
      eventBus.emit("scene.switched", this);

      // Initialize core game elements
      this.loadTiledMap();
      this.createGameGroups();
      this.createPlayerCharacter();
      this.setupCamera();
      this.setupGameSystems();
      this.setupInputHandlers();

      // Spawn game entities
      this.spawnInitialContent();

      eventBus.emit("game.scene.ready", { scene: this });
    } catch (error) {
      console.error("Error in GameScene.create:", error);
      eventBus.emit("ui.error.show", `Error creating game scene: ${(error as Error).message}`);
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

  private createPlayerCharacter(): void {
    const store = useGameStore.getState();
    let startX: number, startY: number;

    if (store.playerCharacter.teleportPosition) {
      startX = store.playerCharacter.teleportPosition.x;
      startY = store.playerCharacter.teleportPosition.y;
      delete store.playerCharacter.teleportPosition;
    } else {
      const defaultSpawn = MapService.getDefaultSpawn(store.currentMap);
      startX = defaultSpawn.x;
      startY = defaultSpawn.y;
    }

    this.playerCharacter = new PlayerCharacter(this, startX, startY);
  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.playerCharacter, true, 100, 100, 0, 0);
    this.cameras.main.setZoom(1.4);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private setupGameSystems(): void {
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

      this.setupCollisions();
      console.log("Game systems initialized successfully");
    } catch (error) {
      console.error("Error initializing game systems:", error);
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

  // =============================================================================
  // MAP LOADING AND MANAGEMENT
  // =============================================================================

  loadTiledMap(): boolean {
    try {
      const store = useGameStore.getState();
      const mapKey = store.currentMap;
      this.map = this.make.tilemap({ key: mapKey });

      // Add tilesets
      const tilesetImages: Phaser.Tilemaps.Tileset[] = [];
      this.map.tilesets.forEach((tileset) => {
        const tilesetImage = this.map?.addTilesetImage(tileset.name, tileset.name);
        if (tilesetImage) {
          tilesetImages.push(tilesetImage);
        } else {
          console.warn(`Failed to add tileset: ${tileset.name}`);
        }
      });

      if (tilesetImages.length === 0) {
        console.error("No valid tilesets found for the map");
        return false;
      }

      // Create layers
      this.map.layers.forEach((layerData) => {
        const layer = this.map?.createLayer(layerData.name, tilesetImages);
        if (!layer) return;

        if (layerData.name === "ground-layer") {
          this.groundLayer = layer;
        } else if (layerData.name === "collision-layer") {
          this.collisionLayer = layer;
          layer.setCollisionByExclusion([-1]);
          layer.setVisible(false);
        } else if (layerData.name === "wall-layer") {
          this.collisionLayer = layer;
        }

        layer.setPosition(0, 0);
      });

      // Set physics bounds
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
    if (this.isChangingMap) return;
    this.isChangingMap = true;

    console.log(`Starting map change to: ${mapKey}`);
    useGameStore.getState().updatePlayerMap(mapKey);
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once("camerafadeoutcomplete", () => {
      try {
        this.cleanupCurrentMap();
        this.loadTiledMap();
        this.reinitializeSystemsForNewMap();

        if (this.playerCharacter) {
          this.playerCharacter.setPosition(destX, destY);
          if (this.playerCharacter.body) {
            this.playerCharacter.body.reset(destX, destY);
          }
          this.cameras.main.centerOn(destX, destY);
        }

        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.cameras.main.once("camerafadeincomplete", () => {
          this.finalizeMapTransition();
          this.isChangingMap = false;

          const displayMessage = message || `Entered ${MapService.getMapName(mapKey)}`;
          eventBus.emit("ui.message.show", displayMessage);
          eventBus.emit("map.changed", mapKey);
          console.log("Map transition completed successfully");
        });
      } catch (error) {
        this.isChangingMap = false;
        console.error("Error in map transition:", error);
      }
    });
  }

  private cleanupCurrentMap(): void {
    try {
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }

      this.physics.pause();
      this.physics.world.colliders.destroy();

      if (this.map) {
        this.map.layers.forEach((layerData) => {
          if (layerData.tilemapLayer) {
            layerData.tilemapLayer.destroy(true);
          }
        });
        this.map.destroy();
        this.map = undefined;
      }

      this.groundLayer = undefined;
      this.collisionLayer = undefined;

      [this.items, this.monsters, this.npcs, this.chests].forEach((group) => {
        if (group) group.clear(true, true);
      });

      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }

      this.physics.resume();
      console.log("Map cleanup completed");
    } catch (error) {
      console.error("Error in GameScene.cleanupCurrentMap:", error);
    }
  }

  private reinitializeSystemsForNewMap(): void {
    try {
      const store = useGameStore.getState();

      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }
      this.itemHoverSystem = new ItemHoverSystem();
      store.registerSystem("itemHoverSystem", this.itemHoverSystem);
      this.itemHoverSystem.setupGlobalPointerHandler(this);

      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }
      this.cursorPositionSystem = new CursorPositionSystem(this, 32);
      this.cursorPositionSystem.initialize();

      this.setupCollisions();
      this.setupInputHandlers();
      this.spawnInitialContent();
    } catch (error) {
      console.error("Error re-initializing systems for new map:", error);
    }
  }

  private finalizeMapTransition(): void {
    try {
      if (this.itemHoverSystem) {
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
  // ENTITY SPAWNING METHODS
  // =============================================================================

  spawnInitialMonsters(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (currentMap === "game-map") {
        // this.spawnMonsterAtTile("decayed-skeleton", 0, 1);
        // this.spawnMonsterAtTile("dark-elf-mage", 15, 2);
        // this.spawnMonsterAtTile("dark-elf-archer", 17, 1);
        // this.spawnMonsterAtTile("dark-elf-knight", 18, 2);
      }
    } catch (error) {
      console.error("Error in GameScene.spawnInitialMonsters:", error);
    }
  }

  private spawnInitialNPCs(): void {
    try {
      const store = useGameStore.getState();
      const currentMap = store.currentMap;

      if (currentMap === "game-map") {
        const alDeeData = NPCService.getNPC("merchant-aldee");
        if (alDeeData) {
          this.spawnNPCAtTile(alDeeData, 34, -23);
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

      if (currentMap === "game-map") {
        this.spawnItemAtTile("fireSword", 17, -57);
      }
    } catch (error) {
      console.error("Error spawning test items:", error);
    }
  }

  // Tile-based spawning methods
  spawnItemAtTile(
    templateId: string,
    tileX: number,
    tileY: number,
    instanceId?: string,
    bonusStats?: ItemBonusStats
  ): Item | null {
    try {
      const store = useGameStore.getState();
      const worldPos = MapService.tiledTileToWorld(tileX, tileY, store.currentMap);
      console.log(
        `Spawning ${templateId} at Tiled tile (${tileX}, ${tileY}) = world (${worldPos.x}, ${worldPos.y})`
      );
      return this.spawnItem(templateId, worldPos.x, worldPos.y, instanceId, bonusStats);
    } catch (error) {
      console.error("Error in GameScene.spawnItemAtTile:", error);
      return null;
    }
  }

  spawnMonsterAtTile(monsterType: string, tileX: number, tileY: number): Monster | null {
    try {
      const store = useGameStore.getState();
      const worldPos = MapService.tiledTileToWorld(tileX, tileY, store.currentMap);
      console.log(
        `Spawning ${monsterType} at Tiled tile (${tileX}, ${tileY}) = world (${worldPos.x}, ${worldPos.y})`
      );
      return this.spawnMonster(monsterType, worldPos.x, worldPos.y);
    } catch (error) {
      console.error("Error in GameScene.spawnMonsterAtTile:", error);
      return null;
    }
  }

  spawnNPCAtTile(npcData: NPCData, tileX: number, tileY: number): NPC | null {
    try {
      const store = useGameStore.getState();
      const worldPos = MapService.tiledTileToWorld(tileX, tileY, store.currentMap);
      console.log(
        `Spawning NPC ${npcData.id} at Tiled tile (${tileX}, ${tileY}) = world (${worldPos.x}, ${worldPos.y})`
      );
      return this.spawnNPC(npcData, worldPos.x, worldPos.y);
    } catch (error) {
      console.error("Error in GameScene.spawnNPCAtTile:", error);
      return null;
    }
  }

  // World coordinate spawning methods
  spawnItem(
    templateId: string,
    x: number,
    y: number,
    instanceId?: string,
    bonusStats?: ItemBonusStats
  ): Item | null {
    try {
      if (!instanceId) {
        const instance =
          Math.random() < 0.2
            ? ItemInstanceManager.createRandomInstance(templateId)
            : ItemInstanceManager.createItemInstance(templateId);
        instanceId = instance.instanceId;
        bonusStats = instance.bonusStats;
      }

      const item = new Item(this, x, y, templateId, instanceId, bonusStats);
      this.items.add(item);

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
      monster.playAnimation("down", false);
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
      npc.playAnimation("down", false);
      return npc;
    } catch (error) {
      console.error("Error in GameScene.spawnNPC:", error);
      return null;
    }
  }

  // =============================================================================
  // UPDATE AND CLEANUP
  // =============================================================================

  update(time: number, delta: number): void {
    try {
      if (this.isChangingMap) return;

      // Update player and camera
      if (this.playerCharacter && this.playerCharacter.active) {
        this.playerCharacter.update(time);
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

      // Update systems
      const systems = useGameStore.getState().systems || {};
      if (systems.autoAttackSystem) {
        systems.autoAttackSystem.update();
      }

      // Update all game entities
      [this.items, this.monsters, this.npcs, this.chests].forEach((group) => {
        if (group) {
          group.getChildren().forEach((gameObject) => {
            const entity = gameObject as any;
            if (entity.active && entity.update) {
              entity.update(time, delta);
            }
          });
        }
      });
    } catch (error) {
      console.error("Error in GameScene.update:", error);
    }
  }

  destroy() {
    try {
      if (this.itemHoverSystem) {
        this.itemHoverSystem.cleanup();
      }
      if (this.cursorPositionSystem) {
        this.cursorPositionSystem.destroy();
      }
      if (this.input?.keyboard) {
        this.input.keyboard.off("keydown-E");
      }
    } catch (error) {
      console.error("Error in GameScene.destroy:", error);
    }
  }
}
