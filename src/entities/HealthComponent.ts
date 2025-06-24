import { Component } from "./Component";
import { Character } from "../entities/Character";
import { eventBus } from "@/utils/EventBus";

export class HealthComponent extends Component {
  private healthBar: Phaser.GameObjects.Graphics | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private isInitialized: boolean = false;

  constructor(entity: Character) {
    super(entity);
  }

  get character(): Character {
    return this.entity as Character;
  }

  initialize(): void {
    try {
      this.createHealthBar();
      this.isInitialized = true;

      // Listen for health changes
      eventBus.on(`entity.${this.entity.id}.health.changed`, this.updateHealthBar.bind(this));

      super.initialize();
    } catch (error) {
      eventBus.emit("error.component", {
        entityId: this.entity.id,
        componentId: "HealthComponent",
        error,
      });
    }
  }

  createHealthBar(): void {
    try {
      // Clean up any existing health bar first
      this.destroyHealthBarElements();

      // Get the proper name to display
      let displayName = this.character.id;

      // Get entity-specific name when available
      if ((this.character as any).monsterName) {
        displayName = (this.character as any).monsterName;
      } else if ((this.character as any).npcName) {
        displayName = (this.character as any).npcName;
      }

      // Create name text with improved styling and higher depth
      this.nameText = this.entity.scene.add.text(this.entity.x, this.entity.y - 42, displayName, {
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        color: "#4bf542",
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#000",
          blur: 3,
          fill: true,
        },
      });
      this.nameText.setOrigin(0.5);
      this.nameText.setDepth(1000); // High depth to ensure visibility

      // Create health bar with high depth
      this.healthBar = this.entity.scene.add.graphics();
      this.healthBar.setDepth(1000); // High depth to ensure visibility

      this.updateHealthBar();

      // Emit event for creation
      eventBus.emit("healthbar.created", {
        entityId: this.entity.id,
        health: this.character.health,
        maxHealth: this.character.maxHealth,
      });
    } catch (error) {
      eventBus.emit("error.healthbar.create", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  updateHealthBar(): void {
    try {
      if (!this.healthBar || !this.nameText) {
        // If health bar elements don't exist, recreate them
        this.createHealthBar();
        return;
      }

      const width = 32;
      const height = 4;

      // Center the health bar
      const x = this.entity.x - width / 2;
      const y = this.entity.y - 32;

      // Update name text position and ensure it's visible
      this.nameText.setPosition(this.entity.x, this.entity.y - 40);
      this.nameText.setVisible(true);
      this.nameText.setDepth(1000);

      // Clear previous drawing
      this.healthBar.clear();

      // Draw background (empty health) with dark border
      this.healthBar.fillStyle(0x000000, 0.8);
      this.healthBar.fillRect(x, y, width, height);

      // Calculate fill width based on health percentage
      const fillWidth = Math.floor((this.character.health / this.character.maxHealth) * width);

      // Choose color based on health percentage
      let color = 0x00ff00; // Green
      if (this.character.health < this.character.maxHealth * 0.6) {
        color = 0xffff00; // Yellow
      }
      if (this.character.health < this.character.maxHealth * 0.3) {
        color = 0xff0000; // Red
      }

      // Draw fill (current health)
      this.healthBar.fillStyle(color, 1);
      this.healthBar.fillRect(x, y, fillWidth, height);

      // Add border for better visibility
      this.healthBar.lineStyle(1, 0x000000, 1);
      this.healthBar.strokeRect(x, y, width, height);

      // Ensure health bar is visible and has proper depth
      this.healthBar.setVisible(true);
      this.healthBar.setDepth(1000);

      // Emit health updated event for React to pick up
      eventBus.emit("healthbar.updated", {
        entityId: this.entity.id,
        health: this.character.health,
        maxHealth: this.character.maxHealth,
        percentage: (this.character.health / this.character.maxHealth) * 100,
      });
    } catch (error) {
      eventBus.emit("error.healthbar.update", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  /**
   * Force refresh the health bar - useful after map changes
   */
  forceRefresh(): void {
    try {
      if (!this.isInitialized) {
        this.initialize();
        return;
      }

      // Recreate the health bar to ensure it's properly visible
      this.createHealthBar();
    } catch (error) {
      console.error(`Error force refreshing health bar for entity ${this.entity.id}:`, error);
    }
  }

  /**
   * Clean up health bar elements
   */
  private destroyHealthBarElements(): void {
    try {
      if (this.healthBar) {
        this.healthBar.destroy();
        this.healthBar = null;
      }

      if (this.nameText) {
        this.nameText.destroy();
        this.nameText = null;
      }
    } catch (error) {
      console.error(`Error destroying health bar elements for entity ${this.entity.id}:`, error);
    }
  }

  update(): void {
    try {
      // Only update if the health bar exists and entity is active
      if (this.entity.active && this.healthBar && this.nameText) {
        this.updateHealthBar();
      }
    } catch (error) {
      eventBus.emit("error.healthbar.update", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  destroy(): void {
    try {
      // Remove event listeners
      eventBus.off(`entity.${this.entity.id}.health.changed`, this.updateHealthBar);

      // Clean up health bar elements
      this.destroyHealthBarElements();

      this.isInitialized = false;

      // Call parent destroy
      super.destroy();
    } catch (error) {
      eventBus.emit("error.healthbar.destroy", {
        entityId: this.entity.id,
        error,
      });
    }
  }
}
