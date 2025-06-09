import { Entity } from "./Entity";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";

export abstract class Character extends Entity {
  health: number = 100;
  maxHealth: number = 100;
  isDead: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, id: string) {
    super(scene, x, y, texture, id);
  }

  takeDamage(amount: number): boolean {
    try {
      if (this.isDead) return false;

      const previousHealth = this.health;
      this.health = Math.max(0, this.health - amount);

      // Emit damage event for UI updates and other systems
      eventBus.emit("character.damage.taken", {
        id: this.id,
        amount,
        currentHealth: this.health,
        previousHealth,
      });

      if (this.health <= 0 && !this.isDead) {
        this.die();
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error applying damage to character ${this.id}:`, error);
      eventBus.emit("error.character.damage", { id: this.id, error });
      return false;
    }
  }

  heal(amount: number): void {
    try {
      if (this.isDead) return;

      const previousHealth = this.health;
      this.health = Math.min(this.maxHealth, this.health + amount);

      // Emit healing event for UI updates and other systems
      eventBus.emit("character.healed", {
        id: this.id,
        amount,
        currentHealth: this.health,
        previousHealth,
      });
    } catch (error) {
      console.error(`Error healing character ${this.id}:`, error);
      eventBus.emit("error.character.heal", { id: this.id, error });
    }
  }

  die(): void {
    try {
      this.isDead = true;

      // Emit death event
      eventBus.emit("character.died", { id: this.id });

      // Base implementation - override in subclasses for specific behavior
    } catch (error) {
      console.error(`Error in die method for character ${this.id}:`, error);
      eventBus.emit("error.character.die", { id: this.id, error });
    }
  }
}
