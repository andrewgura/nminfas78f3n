// src/systems/MonsterSpawnSystem.ts
import { eventBus } from "../utils/EventBus";
import { MapService } from "../services/MapService";
import { useGameStore } from "../stores/gameStore";
import type { GameScene } from "../scenes/GameScene";
import type { Monster } from "../entities/Monster";

interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  monsterType: string;
  respawnTime: number;
  maxCount: number;
  currentMonsters: Monster[];
  lastRespawnTime: number;
  isActive: boolean;
}

export class MonsterSpawnSystem {
  private scene: GameScene;
  private spawnPoints: Map<string, SpawnPoint> = new Map();
  private respawnTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

  constructor(scene: GameScene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  /**
   * Initialize the spawn system by reading monster-layer from the current map
   */
  initialize(): void {
    try {
      this.cleanup();
      this.loadSpawnPointsFromMap();
      this.spawnInitialMonsters();
    } catch (error) {
      console.error("Error initializing MonsterSpawnSystem:", error);
      eventBus.emit("error.spawn.initialize", { error });
    }
  }

  /**
   * Load spawn points from the current map's monster-layer
   */
  private loadSpawnPointsFromMap(): void {
    if (!this.scene.map) {
      console.warn("No map available for monster spawn system");
      return;
    }

    // Get the monster-layer object layer
    const monsterLayer = this.scene.map.getObjectLayer("monster-layer");
    if (!monsterLayer) {
      return;
    }

    // Process each object in the monster layer
    monsterLayer.objects.forEach((obj: any) => {
      try {
        // Extract properties from the Tiled object
        const monsterType = this.getObjectProperty(obj, "monsterType", "");
        const respawnTime = this.getObjectProperty(obj, "respawnTime", 30);
        const maxCount = this.getObjectProperty(obj, "maxCount", 1);

        if (!monsterType) {
          console.warn("Spawn point missing monsterType property:", obj);
          return;
        }

        // Convert raw Tiled coordinates to proper positions
        const tileSize = 32;
        let tiledX, tiledY;

        if (obj.width && obj.height) {
          // For rectangular objects, use center point
          const centerX = obj.x + obj.width / 2;
          const centerY = obj.y + obj.height / 2;
          tiledX = Math.floor(centerX / tileSize);
          tiledY = Math.floor(centerY / tileSize);
        } else {
          // For point objects, convert pixel coordinates directly to tile coordinates
          tiledX = Math.floor(obj.x / tileSize);
          tiledY = Math.floor(obj.y / tileSize);
        }

        // Get current map for coordinate conversion
        const store = useGameStore.getState();
        const currentMap = store.currentMap;

        // Convert Tiled coordinates to Phaser world coordinates using MapService
        const phaserCoords = MapService.tiledToPhaser(currentMap, tiledX, tiledY);

        // Create spawn point
        const spawnPoint: SpawnPoint = {
          id: `spawn_${obj.id}_${Date.now()}`,
          x: phaserCoords.x,
          y: phaserCoords.y,
          monsterType,
          respawnTime: respawnTime * 1000, // Convert to milliseconds
          maxCount,
          currentMonsters: [],
          lastRespawnTime: 0,
          isActive: true,
        };

        this.spawnPoints.set(spawnPoint.id, spawnPoint);
      } catch (error) {
        console.error("Error processing spawn point object:", obj, error);
      }
    });
  }

  /**
   * Helper to get property value from Tiled object
   */
  private getObjectProperty(obj: any, propertyName: string, defaultValue: any): any {
    if (!obj.properties) return defaultValue;

    const property = obj.properties.find((prop: any) => prop.name === propertyName);
    return property ? property.value : defaultValue;
  }

  /**
   * Spawn initial monsters at all spawn points
   */
  private spawnInitialMonsters(): void {
    this.spawnPoints.forEach((spawnPoint) => {
      this.spawnMonstersAtPoint(spawnPoint);
    });
  }

  /**
   * Spawn monsters at a specific spawn point up to maxCount
   */
  private spawnMonstersAtPoint(spawnPoint: SpawnPoint): void {
    if (!spawnPoint.isActive) return;

    // Clean up any dead monsters from the list
    spawnPoint.currentMonsters = spawnPoint.currentMonsters.filter(
      (monster) => monster && !monster.isDead && monster.scene
    );

    // Determine how many monsters to spawn
    const monstersToSpawn = spawnPoint.maxCount - spawnPoint.currentMonsters.length;

    for (let i = 0; i < monstersToSpawn; i++) {
      this.spawnSingleMonster(spawnPoint);
    }
  }

  /**
   * Spawn a single monster at a spawn point
   */
  private spawnSingleMonster(spawnPoint: SpawnPoint): void {
    try {
      // Add some randomization to spawn position to prevent overlapping
      const offsetRange = 16; // ±16 pixels
      const randomX = spawnPoint.x + (Math.random() - 0.5) * offsetRange;
      const randomY = spawnPoint.y + (Math.random() - 0.5) * offsetRange;

      const monster = this.scene.spawnMonster(spawnPoint.monsterType, randomX, randomY);

      if (monster) {
        // Store reference to the spawn point in the monster
        (monster as any).spawnPointId = spawnPoint.id;

        // Add to spawn point's monster list
        spawnPoint.currentMonsters.push(monster);
      }
    } catch (error) {
      console.error(`Error spawning monster at spawn point ${spawnPoint.id}:`, error);
    }
  }

  /**
   * Handle monster death and schedule respawn
   */
  private handleMonsterDeath(data: any): void {
    try {
      // Find which spawn point this monster belonged to
      let targetSpawnPoint: SpawnPoint | null = null;

      this.spawnPoints.forEach((spawnPoint) => {
        const monsterIndex = spawnPoint.currentMonsters.findIndex(
          (monster) =>
            monster.x === data.x && monster.y === data.y && monster.monsterType === data.type
        );

        if (monsterIndex >= 0) {
          // Remove the dead monster from the spawn point
          spawnPoint.currentMonsters.splice(monsterIndex, 1);
          targetSpawnPoint = spawnPoint;
        }
      });

      if (targetSpawnPoint) {
        this.scheduleRespawn(targetSpawnPoint);
      }
    } catch (error) {
      console.error("Error handling monster death:", error);
    }
  }

  /**
   * Schedule respawn for a spawn point
   */
  private scheduleRespawn(spawnPoint: SpawnPoint): void {
    try {
      // Clear any existing timer for this spawn point
      const existingTimer = this.respawnTimers.get(spawnPoint.id);
      if (existingTimer) {
        existingTimer.remove();
      }

      // Schedule new respawn
      const timer = this.scene.time.delayedCall(spawnPoint.respawnTime, () => {
        this.spawnMonstersAtPoint(spawnPoint);
        this.respawnTimers.delete(spawnPoint.id);
      });

      this.respawnTimers.set(spawnPoint.id, timer);
    } catch (error) {
      console.error(`Error scheduling respawn for spawn point ${spawnPoint.id}:`, error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    eventBus.on("monster.died", this.handleMonsterDeath.bind(this));
  }

  /**
   * Cleanup the spawn system
   */
  cleanup(): void {
    try {
      // Clear all respawn timers
      this.respawnTimers.forEach((timer) => {
        if (timer) {
          timer.remove();
        }
      });
      this.respawnTimers.clear();

      // Clear spawn points
      this.spawnPoints.clear();
    } catch (error) {
      console.error("Error during MonsterSpawnSystem cleanup:", error);
    }
  }

  /**
   * Get information about all spawn points (for debugging)
   */
  getSpawnPointInfo(): Array<{
    id: string;
    monsterType: string;
    position: { x: number; y: number };
    currentCount: number;
    maxCount: number;
    respawnTime: number;
  }> {
    const info: Array<any> = [];

    this.spawnPoints.forEach((spawnPoint) => {
      info.push({
        id: spawnPoint.id,
        monsterType: spawnPoint.monsterType,
        position: { x: spawnPoint.x, y: spawnPoint.y },
        currentCount: spawnPoint.currentMonsters.length,
        maxCount: spawnPoint.maxCount,
        respawnTime: spawnPoint.respawnTime / 1000,
      });
    });

    return info;
  }

  /**
   * Force respawn all monsters at all spawn points (for debugging)
   */
  forceRespawnAll(): void {
    this.spawnPoints.forEach((spawnPoint) => {
      this.spawnMonstersAtPoint(spawnPoint);
    });
  }

  /**
   * Destroy the spawn system
   */
  destroy(): void {
    try {
      this.cleanup();
      eventBus.off("monster.died", this.handleMonsterDeath.bind(this));
    } catch (error) {
      console.error("Error destroying MonsterSpawnSystem:", error);
    }
  }
}
