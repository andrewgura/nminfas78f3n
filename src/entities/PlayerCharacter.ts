import { Character } from "./Character";
import { HealthComponent } from "./HealthComponent";
import { MovementComponent } from "./player/MovementComponent";
import { PlayerInputComponent } from "./player/PlayerInputComponent";
import { PlayerItemInteractionComponent } from "./player/PlayerItemInteractionComponent";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { DamageFormulas } from "@/utils/formulas";

export class PlayerCharacter extends Character {
  equipment: any;
  healthBarSystem: any;
  nearbyItems: any[] = [];
  interactionZone: Phaser.GameObjects.Arc | null = null;
  facing: string = "down";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "playerCharacter", "player");

    try {
      // Get state from store
      const store = useGameStore.getState();

      // Set player properties from game state
      this.health = store.playerCharacter.health;
      this.maxHealth = store.playerCharacter.maxHealth;

      // Update max health in store to ensure consistency
      store.updatePlayerMaxHealth(this.maxHealth);

      this.setOrigin(0.8, 0.8); // Set the sprite to be in the center of tile

      // Set equipment from store - UPDATED to work with ItemInstance
      const storeEquipment = store.playerCharacter.equipment;
      this.equipment = {
        weapon: storeEquipment.weapon
          ? ItemInstanceManager.getCombinedStats(storeEquipment.weapon)
          : null,
        shield: storeEquipment.shield
          ? ItemInstanceManager.getCombinedStats(storeEquipment.shield)
          : null,
        trinket: storeEquipment.trinket
          ? ItemInstanceManager.getCombinedStats(storeEquipment.trinket)
          : null,
        helmet: storeEquipment.helmet
          ? ItemInstanceManager.getCombinedStats(storeEquipment.helmet)
          : null,
        amulet: storeEquipment.amulet
          ? ItemInstanceManager.getCombinedStats(storeEquipment.amulet)
          : null,
        armor: storeEquipment.armor
          ? ItemInstanceManager.getCombinedStats(storeEquipment.armor)
          : null,
      };

      // Add components
      this.addComponents();

      // Listen for equipment changes to update local equipment
      eventBus.on("equipment.changed", this.handleEquipmentChanged.bind(this));

      // Emit player created event
      eventBus.emit("player.created", {
        health: this.health,
        maxHealth: this.maxHealth,
        position: { x: this.x, y: this.y },
      });
    } catch (error) {
      console.error("Error in PlayerCharacter constructor:", error);
      eventBus.emit("error.player.create", { error });
    }
  }

  private handleEquipmentChanged(data: { equipment: any; source: string }): void {
    try {
      // Update local equipment with combined stats for easy access
      const storeEquipment = data.equipment;
      this.equipment = {
        weapon: storeEquipment.weapon
          ? ItemInstanceManager.getCombinedStats(storeEquipment.weapon)
          : null,
        shield: storeEquipment.shield
          ? ItemInstanceManager.getCombinedStats(storeEquipment.shield)
          : null,
        trinket: storeEquipment.trinket
          ? ItemInstanceManager.getCombinedStats(storeEquipment.trinket)
          : null,
        helmet: storeEquipment.helmet
          ? ItemInstanceManager.getCombinedStats(storeEquipment.helmet)
          : null,
        amulet: storeEquipment.amulet
          ? ItemInstanceManager.getCombinedStats(storeEquipment.amulet)
          : null,
        armor: storeEquipment.armor
          ? ItemInstanceManager.getCombinedStats(storeEquipment.armor)
          : null,
      };

      // Emit equipment updated event for other systems
      eventBus.emit("player.equipment.updated", {
        equipment: this.equipment,
        source: data.source,
      });
    } catch (error) {
      console.error("Error handling equipment change:", error);
      eventBus.emit("error.player.equipment", { error });
    }
  }

  private addComponents(): void {
    try {
      // Health component
      this.components.add("health", new HealthComponent(this));

      // Movement component
      const movementComponent = new MovementComponent(this);
      this.components.add("movement", movementComponent);

      // Input component
      this.components.add("input", new PlayerInputComponent(this));

      // Item interaction component
      this.components.add("interaction", new PlayerItemInteractionComponent(this));

      // Listen for respawn events
      eventBus.on("player.respawn", this.respawn.bind(this));
    } catch (error) {
      console.error("Error adding components to PlayerCharacter:", error);
      eventBus.emit("error.player.components", { error });
    }
  }

  update(time: number): void {
    try {
      if (this.isDead) return;

      // Call parent update method (updates all components)
      super.update(time, 0);
    } catch (error) {
      console.error("Error in PlayerCharacter update:", error);
      eventBus.emit("error.player.update", { error });
    }
  }

  playAnimation(direction: string, isMoving: boolean): void {
    try {
      if (this.isDead) return;

      const animKey = isMoving ? `walk-${direction}` : `idle-${direction}`;

      // Update facing direction
      this.facing = direction;

      // Only play animation if it's not already playing
      if (!this.anims.isPlaying || this.anims.currentAnim?.key !== animKey) {
        this.anims.play(animKey, true);

        // Emit animation event for React
        eventBus.emit("player.animation", {
          direction,
          isMoving,
          animation: animKey,
        });
      }
    } catch (error) {
      console.error("Error in PlayerCharacter playAnimation:", error);
      eventBus.emit("error.player.animation", { error, direction, isMoving });
    }
  }

  // Methods for item interaction
  addNearbyItem(item: any): void {
    if (!this.nearbyItems.includes(item)) {
      this.nearbyItems.push(item);

      // Also add to the interaction component
      const interactionComponent =
        this.components.get<PlayerItemInteractionComponent>("interaction");
      if (interactionComponent) {
        interactionComponent.addNearbyItem(item);
      }

      // Emit event for React
      eventBus.emit("player.item.nearby", {
        itemId: item.instanceId,
        itemName: item.name,
        action: "added",
      });
    }
  }

  removeNearbyItem(item: any): void {
    const index = this.nearbyItems.indexOf(item);
    if (index !== -1) {
      this.nearbyItems.splice(index, 1);

      // Also remove from the interaction component
      const interactionComponent =
        this.components.get<PlayerItemInteractionComponent>("interaction");
      if (interactionComponent) {
        interactionComponent.removeNearbyItem(item);
      }

      // Emit event for React
      eventBus.emit("player.item.nearby", {
        itemId: item.instanceId,
        itemName: item.name,
        action: "removed",
      });
    }
  }

  pickupNearbyItem(): void {
    const interactionComponent = this.components.get<PlayerItemInteractionComponent>("interaction");
    if (interactionComponent) {
      interactionComponent.pickupNearbyItem();
    }
  }

  takeDamage(amount: number, isMagicDamage: boolean = false): boolean {
    try {
      // Skip if already dead
      if (this.isDead) return false;

      // Get current player state from store
      const store = useGameStore.getState();
      const equipment = store.playerCharacter.equipment;
      const skills = store.playerCharacter.skills;

      // Calculate final damage using our new formulas
      const finalDamage = DamageFormulas.calculatePlayerDamageTaken(
        amount,
        equipment,
        skills,
        isMagicDamage
      );

      // Calculate new health
      const newHealth = Math.max(0, this.health - finalDamage);

      // Emit damage taken event for UI effects
      eventBus.emit("playerCharacter.damage.taken", finalDamage);

      // Award shield skill points when taking damage (only if shield equipped and physical damage)
      if (!isMagicDamage && equipment.shield && store.playerCharacter.skills.shield) {
        const currentExp = store.playerCharacter.skills.shield.experience;
        const expGained = Math.max(1, Math.floor(finalDamage * 0.5));
        store.updateSkill("shield", currentExp + expGained);
      }

      // Update health
      this.health = newHealth;

      // Set to dead if health reaches 0
      if (this.health <= 0 && !this.isDead) {
        this.die();
        return true;
      }

      // Update global game state health
      useGameStore.getState().updatePlayerHealth(this.health);

      // Visual effects (existing code)
      const originalAlpha = this.alpha;
      this.scene.tweens.add({
        targets: this,
        alpha: 0.7,
        duration: 100,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.alpha = originalAlpha;
        },
        onStop: () => {
          this.alpha = originalAlpha;
        },
      });

      // Shake camera for significant damage
      if (finalDamage > this.maxHealth * 0.1) {
        this.scene.cameras.main.shake(250, 0.01);
      }

      // Show floating damage number
      this.showDamageNumber(finalDamage);

      return false;
    } catch (error) {
      console.error("Error in PlayerCharacter takeDamage:", error);
      eventBus.emit("error.player.damage", { error, amount });
      return false;
    }
  }

  refreshUIComponents(): void {
    try {
      // Force refresh the health component with proper typing
      const healthComponent = this.components.get("health") as HealthComponent;
      if (healthComponent && typeof healthComponent.forceRefresh === "function") {
        healthComponent.forceRefresh();
      }
    } catch (error) {
      console.error("Error refreshing PlayerCharacter UI components:", error);
      eventBus.emit("error.player.refresh", { error });
    }
  }

  private showDamageNumber(amount: number): void {
    try {
      const text = this.scene.add.text(this.x, this.y - 20, `-${amount}`, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
      });

      text.setOrigin(0.5);
      text.setDepth(100);

      this.scene.tweens.add({
        targets: text,
        y: this.y - 60,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          text.destroy();
        },
      });
    } catch (error) {
      console.error("Error showing damage number:", error);
    }
  }

  die(): void {
    try {
      if (this.isDead) return;

      // Call parent die method
      super.die();

      // Display death message
      eventBus.emit("ui.message.show", "You have been defeated!");

      // Play death animation
      this.scene.tweens.add({
        targets: this,
        alpha: 0.5,
        angle: 90,
        duration: 500,
        ease: "Power2",
        onComplete: () => {
          // Disable input
          const inputComponent = this.components.get("input");
          if (inputComponent) {
            inputComponent.disable();
          }

          // Trigger death event to show respawn dialog
          eventBus.emit("player.died");
        },
      });
    } catch (error) {
      console.error("Error in PlayerCharacter die:", error);
      eventBus.emit("error.player.die", { error });
    }
  }

  respawn(position: { x: number; y: number }): void {
    try {
      // Reset health
      this.health = this.maxHealth;
      this.isDead = false;

      // Update game state health
      const store = useGameStore.getState();
      store.updatePlayerHealth(this.health);
      store.updatePlayerMaxHealth(this.maxHealth);

      // Move to respawn position
      this.x = position.x;
      this.y = position.y;

      // Reset visual appearance
      this.alpha = 1;
      this.angle = 0;

      // Re-enable input
      const inputComponent = this.components.get("input");
      if (inputComponent) {
        inputComponent.enable();
      }

      // Update the camera to follow player at new position
      this.scene.cameras.main.startFollow(this);

      // Emit respawn completed event
      eventBus.emit("player.respawned", {
        position: { x: this.x, y: this.y },
        health: this.health,
      });
    } catch (error) {
      console.error("Error in PlayerCharacter respawn:", error);
      eventBus.emit("error.player.respawn", { error });
    }
  }

  destroy(): void {
    try {
      // Clean up equipment change listener
      eventBus.off("equipment.changed", this.handleEquipmentChanged);

      // Call parent destroy
      super.destroy();
    } catch (error) {
      console.error("Error in PlayerCharacter destroy:", error);
    }
  }
}
