import { Entity } from "./Entity";
import { eventBus } from "@/utils/EventBus";
import { ItemBonusStats } from "@/types";

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
  private lootTable: string = "default";
  private respawnTime: number = 300; // Default 5 minutes in seconds
  private interactionZone: Phaser.GameObjects.Zone | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    lootTable: string = "default",
    respawnTime: number = 300
  ) {
    super(scene, x, y, "chest-closed", id);

    this.lootTable = lootTable;
    this.respawnTime = respawnTime;
    this.setupInteractionZone();
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
    // Show interaction hint when player is nearby and chest is closed
    if (this.texture.key === "chest-closed") {
      eventBus.emit("ui.message.show", "Click to open chest");
    }
  }

  public open(): void {
    // Change to open texture
    this.setTexture("chest-open");

    // Spawn loot around the chest
    this.spawnLoot();

    // Emit opened event
    eventBus.emit("chest.opened", {
      id: this.id,
      position: { x: this.x, y: this.y },
    });

    // Schedule respawn
    this.scheduleRespawn();
  }

  private scheduleRespawn(): void {
    // Convert seconds to milliseconds
    const respawnTimeMs = this.respawnTime * 1000;

    // Create a timer to respawn the chest
    this.scene.time.delayedCall(respawnTimeMs, () => {
      this.setTexture("chest-closed");
      eventBus.emit("ui.message.show", "A chest has respawned nearby");
      console.log(`Chest ${this.id} respawned`);
    });
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
    // Example loot tables - replace with your actual loot table system
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

  public isOpen(): boolean {
    return this.texture.key === "chest-open";
  }

  update(time: number, delta?: number): void {
    super.update(time, delta);

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
