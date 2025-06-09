import { eventBus } from "../utils/EventBus";
import { useGameStore } from "../stores/gameStore";

class HealthSystemService {
  constructor() {
    this.initialize();
  }

  initialize(): void {
    // Subscribe to damage events
    eventBus.on("damage.taken", this.handleDamageTaken.bind(this));
    eventBus.on("healing.received", this.handleHealingReceived.bind(this));
  }

  /**
   * Handle damage taken by the player
   */
  handleDamageTaken(data: { amount: number; source: string }): void {
    if (!data) return;

    const store = useGameStore.getState();
    const currentHealth = store.playerCharacter.health;

    // Calculate new health
    const newHealth = Math.max(0, currentHealth - data.amount);

    // Update health in store
    store.updatePlayerHealth(newHealth);

    // Show damage effect
    eventBus.emit("playerCharacter.damage.taken", data.amount);

    // Check for death
    if (newHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  /**
   * Handle healing received by the player
   */
  handleHealingReceived(data: { amount: number; source: string }): void {
    if (!data) return;

    const store = useGameStore.getState();
    const currentHealth = store.playerCharacter.health;
    const maxHealth = store.playerCharacter.maxHealth;

    // Calculate new health, capped at max
    const newHealth = Math.min(maxHealth, currentHealth + data.amount);

    // Update health in store
    store.updatePlayerHealth(newHealth);

    // Show healing effect
    eventBus.emit("playerCharacter.healing.received", data.amount);
  }

  /**
   * Apply direct damage to player
   */
  applyDamage(amount: number, source: string = "environmental"): void {
    this.handleDamageTaken({ amount, source });
  }

  /**
   * Apply healing to player
   */
  applyHealing(amount: number, source: string = "potion"): void {
    this.handleHealingReceived({ amount, source });
  }

  /**
   * Process player death
   */
  private handlePlayerDeath(): void {
    // Set health to exactly 0 to ensure consistent state
    useGameStore.getState().updatePlayerHealth(0);

    // Emit death event for UI and other systems
    eventBus.emit("player.died", null);
  }

  /**
   * Resurrect player with specified percentage of health
   */
  resurrectPlayer(healthPercentage: number = 25): void {
    const store = useGameStore.getState();
    const maxHealth = store.playerCharacter.maxHealth;

    // Calculate health to restore
    const restoredHealth = Math.floor(maxHealth * (healthPercentage / 100));

    // Update health
    store.updatePlayerHealth(restoredHealth);

    // Emit resurrection event
    eventBus.emit("player.resurrected", { healthRestored: restoredHealth });
  }

  /**
   * Update player's maximum health
   */
  updateMaxHealth(newMaxHealth: number): void {
    const store = useGameStore.getState();
    store.updatePlayerMaxHealth(newMaxHealth);

    // Optionally scale current health proportionally
    // const currentHealthPercentage = store.playerCharacter.health / store.playerCharacter.maxHealth;
    // store.updatePlayerHealth(Math.floor(newMaxHealth * currentHealthPercentage));
  }

  dispose(): void {
    // Clean up event listeners
    eventBus.off("damage.taken", this.handleDamageTaken);
    eventBus.off("healing.received", this.handleHealingReceived);
  }
}

// Create and export singleton instance
export const healthSystem = new HealthSystemService();
