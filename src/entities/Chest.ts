import { Entity } from "./Entity";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";
import { ItemBonusStats } from "@/types";

// Define interfaces for type safety
interface ChestState {
  isOpen: boolean;
  lastOpenedTime: number;
}

interface ChestStorage {
  [key: string]: ChestState;
}

interface LootItem {
  templateId: string;
  chance: number;
  bonusStats?: ItemBonusStats;
  amount?: number[];
}

interface LootTables {
  [key: string]: LootItem[];
}

interface LootDrop {
  templateId: string;
  bonusStats?: ItemBonusStats;
}

export class Chest extends Entity {
  private isOpen: boolean = false;
  private lastOpenedTime: number = 0;
  private lootTable: string = "default";
  private cooldownTimer: number = 30 * 60 * 1000; // 30 minutes in milliseconds
  private interactionZone: Phaser.GameObjects.Zone | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    lootTable: string = "default"
  ) {
    super(scene, x, y, "chest-closed", id);

    this.lootTable = lootTable;
    this.setupInteractionZone();
    this.loadSavedState();
  }

  private setupInteractionZone(): void {
    // Create an interaction zone around the chest
    this.interactionZone = this.scene.add.zone(this.x, this.y, 48, 48);
    this.scene.physics.add.existing(this.interactionZone, true);

    // Setup overlap with player
    if ((this.scene as any).playerCharacter) {
      this.scene.physics.add.overlap(
        this.interactionZone,
        (this.scene as any).playerCharacter,
        this.handlePlayerNearby.bind(this)
      );
    }
  }

  private handlePlayerNearby(): void {
    // Show interaction hint when player is nearby
    if (!this.isOpen && this.canOpen()) {
      eventBus.emit("ui.message.show", "Click to open chest");
    }
  }

  private loadSavedState(): void {
    // Load chest state from localStorage or game state
    const savedChests = localStorage.getItem("game_chests");

    if (savedChests) {
      const chestsData = JSON.parse(savedChests) as ChestStorage;
      if (chestsData[this.id]) {
        this.isOpen = chestsData[this.id].isOpen;
        this.lastOpenedTime = chestsData[this.id].lastOpenedTime;

        // Update visual state
        if (this.isOpen) {
          this.setTexture("chest-open");
        }
      }
    }
  }

  private saveState(): void {
    // Save chest state to localStorage or game state
    let chestsData: ChestStorage = {};
    const savedChests = localStorage.getItem("game_chests");

    if (savedChests) {
      chestsData = JSON.parse(savedChests) as ChestStorage;
    }

    chestsData[this.id] = {
      isOpen: this.isOpen,
      lastOpenedTime: this.lastOpenedTime,
    };

    localStorage.setItem("game_chests", JSON.stringify(chestsData));
  }

  public canOpen(): boolean {
    const currentTime = Date.now();
    return !this.isOpen || currentTime - this.lastOpenedTime > this.cooldownTimer;
  }

  public open(): void {
    if (!this.canOpen()) {
      const remainingTime = this.getRemainingCooldownTime();
      eventBus.emit("ui.message.show", `This chest will reset in ${remainingTime}`);
      return;
    }

    this.isOpen = true;
    this.lastOpenedTime = Date.now();
    this.setTexture("chest-open");
    this.spawnLoot();
    this.saveState();

    eventBus.emit("chest.opened", {
      id: this.id,
      position: { x: this.x, y: this.y },
    });
  }

  private getRemainingCooldownTime(): string {
    const currentTime = Date.now();
    const timeSinceOpened = currentTime - this.lastOpenedTime;
    const remainingTime = this.cooldownTimer - timeSinceOpened;

    // Format as minutes:seconds
    const minutes = Math.floor(remainingTime / (60 * 1000));
    const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

    return `${minutes}m ${seconds}s`;
  }

  private spawnLoot(): void {
    // Get loot table and spawn items
    const loot = this.getLootFromTable(this.lootTable);

    // Spread items around the chest
    const radius = 40;
    loot.forEach((item, index) => {
      const angle = (index / loot.length) * Math.PI * 2;
      const x = this.x + Math.cos(angle) * radius;
      const y = this.y + Math.sin(angle) * radius;

      // Use your existing spawnItem functionality to create the item
      const gameScene = this.scene as any;
      if (gameScene.spawnItem) {
        gameScene.spawnItem(item.templateId, x, y, undefined, item.bonusStats);
      }
    });
  }

  private getLootFromTable(lootTableId: string): LootDrop[] {
    // This would be replaced with your actual loot table system
    // Example implementation:
    const lootTables: LootTables = {
      default: [
        { templateId: "sword1", chance: 0.5 },
        { templateId: "greatSword", chance: 0.3, bonusStats: { power: 1 } },
        { templateId: "gold", amount: [10, 50], chance: 1.0 },
      ],
      dungeon: [
        { templateId: "boneClub", chance: 0.4 },
        { templateId: "skullCap", chance: 0.2 },
        { templateId: "gold", amount: [50, 100], chance: 1.0 },
      ],
      forest: [
        { templateId: "woodenStaff", chance: 0.6 },
        { templateId: "twigBow", chance: 0.3 },
        { templateId: "gold", amount: [5, 25], chance: 1.0 },
      ],
    };

    // Get the loot table or fallback to default
    const table = lootTables[lootTableId] || lootTables.default;
    const loot: LootDrop[] = [];

    // Roll for each possible item
    table.forEach((item) => {
      if (Math.random() <= item.chance) {
        if (item.templateId === "gold" && item.amount) {
          // Gold has a range, roll for amount
          const amount = Math.floor(
            Math.random() * (item.amount[1] - item.amount[0] + 1) + item.amount[0]
          );
          // Add multiple gold entries based on amount
          for (let i = 0; i < amount; i++) {
            loot.push({ templateId: "gold" });
          }
        } else {
          loot.push({
            templateId: item.templateId,
            bonusStats: item.bonusStats,
          });
        }
      }
    });

    return loot;
  }

  update(time: number, delta?: number): void {
    super.update(time, delta);

    // Check if chest should automatically reset
    if (this.isOpen && Date.now() - this.lastOpenedTime > this.cooldownTimer) {
      this.isOpen = false;
      this.setTexture("chest-closed");
    }

    // Update interaction zone position
    if (this.interactionZone) {
      this.interactionZone.x = this.x;
      this.interactionZone.y = this.y;
    }
  }

  destroy(): void {
    if (this.interactionZone) {
      this.interactionZone.destroy();
      this.interactionZone = null;
    }
    super.destroy();
  }
}
