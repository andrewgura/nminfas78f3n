// src/services/AutoAttackSystem.ts
import { eventBus } from "../utils/EventBus";
import { useGameStore } from "../stores/gameStore";
import { ItemDictionary } from "./ItemDictionaryService";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { DamageFormulas } from "@/utils/formulas";

class AutoAttackSystemService {
  private targetedEnemy: any | null = null;
  private lastAttackTime: number = 0;
  private attackCooldown: number = 1000; // 1 second between attacks
  private attackRange: number = 64; // Default range (2 tiles)
  private isAutoAttacking: boolean = false;
  private currentWeaponType: string = "melee"; // Default weapon type
  private storeUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  initialize(): void {
    // Subscribe directly to store changes for equipment
    this.storeUnsubscribe = useGameStore.subscribe(
      (state) => state.playerCharacter.equipment,
      () => {
        this.updateAttackProperties();
      },
      {
        equalityFn: (a, b) => {
          // Custom equality check to detect weapon changes
          return a?.weapon?.templateId === b?.weapon?.templateId;
        },
      }
    );

    // Subscribe to monster death
    eventBus.on("monster.died", this.handleMonsterDeath.bind(this));

    // Initialize attack properties
    this.updateAttackProperties();
  }

  /**
   * Set target for auto-attacking
   */
  setTarget(monster: any): void {
    // Clear existing target
    this.clearTarget();

    // Set new target
    this.targetedEnemy = monster;
    this.isAutoAttacking = true;

    // Reset attack time to allow immediate first attack
    this.lastAttackTime = 0;

    // Show target indicator on the monster itself
    if (typeof monster.showTargetIndicator === "function") {
      monster.showTargetIndicator();
    }

    // Notify UI or other systems about targeting
    eventBus.emit("target.selected", { target: monster });
  }

  /**
   * Clear current target
   */
  clearTarget(): void {
    if (!this.targetedEnemy) return;

    // Hide target indicator on the current target
    if (this.targetedEnemy && typeof this.targetedEnemy.hideTargetIndicator === "function") {
      this.targetedEnemy.hideTargetIndicator();
    }

    const previousTarget = this.targetedEnemy;
    this.isAutoAttacking = false;
    this.targetedEnemy = null;

    // Notify about untargeting
    eventBus.emit("target.cleared", { previousTarget });
  }

  /**
   * Handle monster death
   */
  private handleMonsterDeath(data: { type: string; name: string }): void {
    if (!data || !this.targetedEnemy) return;

    // If our targeted monster died, clear the target
    if (this.targetedEnemy.monsterType === data.type || this.targetedEnemy.name === data.name) {
      this.clearTarget();
    }
  }

  /**
   * Update attack properties based on equipped weapon
   * Now properly reads from GameStore as single source of truth
   */
  private updateAttackProperties(): void {
    try {
      // Read current equipment from GameStore (single source of truth)
      const equipment = useGameStore.getState().playerCharacter.equipment;
      const weaponEquipped = equipment.weapon;

      if (weaponEquipped && weaponEquipped.templateId) {
        // Get weapon type from the item dictionary
        const weaponType = ItemDictionary.getWeaponType(weaponEquipped.templateId);

        this.currentWeaponType = weaponType || "melee";

        // Set attack range based on weapon type
        switch (this.currentWeaponType) {
          case "melee":
            this.attackRange = 64; // 2 tiles
            this.attackCooldown = 1000; // 1 second
            break;
          case "archery":
            this.attackRange = 320; // 10 tiles
            this.attackCooldown = 1200; // 1.2 seconds
            break;
          case "magic":
            this.attackRange = 256; // 8 tiles
            this.attackCooldown = 1500; // 1.5 seconds
            break;
          default:
            // Default values for other/unknown weapon types
            this.attackRange = 64; // 2 tiles
            this.attackCooldown = 1000; // 1 second
            this.currentWeaponType = "melee";
            break;
        }
      } else {
        // No weapon equipped - use default values (melee)
        this.attackRange = 48; // 1.5 tiles
        this.attackCooldown = 1200; // Slower attack speed
        this.currentWeaponType = "melee";
      }
    } catch (error) {
      console.error("Error in updateAttackProperties:", error);
    }
  }

  /**
   * Display floating damage number above the target
   */
  private showDamageNumber(x: number, y: number, damage: number): void {
    try {
      const gameScene = this.getGameScene();
      if (!gameScene) return;

      const text = gameScene.add.text(x, y - 20, `-${damage}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
      });

      text.setOrigin(0.5);
      text.setDepth(100);

      gameScene.tweens.add({
        targets: text,
        y: y - 40,
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

  /**
   * Create a visual effect for an attack
   */
  private createAttackEffect(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): void {
    try {
      if (this.currentWeaponType === "melee") {
        // Melee slash effect
        const slash = scene.add.ellipse(targetX, targetY, 40, 20, 0xffffff, 0.8);
        slash.setRotation(Phaser.Math.Angle.Between(startX, startY, targetX, targetY));
        slash.setDepth(6);

        // Emit melee attack event
        eventBus.emit("player.attack.impact", {
          attackType: "melee",
          position: { x: targetX, y: targetY },
        });

        scene.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 200,
          onComplete: () => {
            slash.destroy();
          },
        });
      } else if (this.currentWeaponType === "archery") {
        // Arrow projectile
        const arrow = scene.add.ellipse(startX, startY, 20, 4, 0x8b4513, 1);
        arrow.setRotation(Phaser.Math.Angle.Between(startX, startY, targetX, targetY));
        arrow.setDepth(6);

        // Emit projectile start event
        eventBus.emit("player.attack.projectile", {
          attackType: "archery",
          startPosition: { x: startX, y: startY },
          targetPosition: { x: targetX, y: targetY },
        });

        scene.tweens.add({
          targets: arrow,
          x: targetX,
          y: targetY,
          duration: 300,
          onComplete: () => {
            arrow.destroy();

            // Create impact effect
            const impact = scene.add.circle(targetX, targetY, 8, 0xffffff, 0.8);
            impact.setDepth(6);
            scene.tweens.add({
              targets: impact,
              alpha: 0,
              scale: 2,
              duration: 200,
              onComplete: () => {
                impact.destroy();
              },
            });

            // Emit impact event
            eventBus.emit("player.attack.impact", {
              attackType: "archery",
              position: { x: targetX, y: targetY },
            });
          },
        });
      } else if (this.currentWeaponType === "magic") {
        // Magic bolt
        const bolt = scene.add.circle(startX, startY, 6, 0x00aaff, 0.8);
        bolt.setDepth(6);

        // Add a glow
        const glow = scene.add.circle(startX, startY, 10, 0x00aaff, 0.4);
        glow.setDepth(5);

        // Emit projectile start event
        eventBus.emit("player.attack.projectile", {
          attackType: "magic",
          startPosition: { x: startX, y: startY },
          targetPosition: { x: targetX, y: targetY },
        });

        scene.tweens.add({
          targets: [bolt, glow],
          x: targetX,
          y: targetY,
          duration: 400,
          onComplete: () => {
            bolt.destroy();
            glow.destroy();

            // Create impact effect
            const impact = scene.add.circle(targetX, targetY, 15, 0x00aaff, 0.6);
            impact.setDepth(6);
            scene.tweens.add({
              targets: impact,
              alpha: 0,
              scale: 2,
              duration: 300,
              onComplete: () => {
                impact.destroy();
              },
            });

            // Emit impact event
            eventBus.emit("player.attack.impact", {
              attackType: "magic",
              position: { x: targetX, y: targetY },
            });
          },
        });
      }
    } catch (error) {
      console.error("Error creating player attack effect:", error);
    }
  }

  /**
   * Perform an attack if conditions are met
   */
  performAttack(): boolean {
    try {
      if (!this.targetedEnemy || !this.isAutoAttacking) {
        return false;
      }

      const now = Date.now();
      const timeSinceLastAttack = now - this.lastAttackTime;

      if (timeSinceLastAttack < this.attackCooldown) {
        return false; // Attack on cooldown
      }

      // Get scene and player character directly from Phaser game instance
      const gameScene = this.getGameScene();
      if (!gameScene) {
        return false;
      }

      const player = gameScene.playerCharacter;
      if (!player) {
        return false;
      }

      // Calculate actual distance
      const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        this.targetedEnemy.x,
        this.targetedEnemy.y
      );

      // Only attack if in range
      if (distance <= this.attackRange) {
        // Default to hit
        let doesHit = true;

        // Handle special case for archery weapons
        if (this.currentWeaponType === "archery") {
          // Archers have penalty at close range
          const adjacentDistance = 48; // About 1.5 tiles

          if (distance <= adjacentDistance) {
            // 25% chance to miss when adjacent
            doesHit = Math.random() >= 0.25;
          }
        }

        // If the attack will hit, apply damage
        if (doesHit) {
          // Get attack damage from equipment
          let damage = this.calculateDamage();

          // Apply damage to enemy
          this.applyDamageToTarget(damage);

          // Show floating damage number
          this.showDamageNumber(this.targetedEnemy.x, this.targetedEnemy.y, damage);

          // Play attack animation based on weapon type
          this.createAttackEffect(
            gameScene,
            player.x,
            player.y,
            this.targetedEnemy.x,
            this.targetedEnemy.y
          );

          // Emit damage event for skill progression
          eventBus.emit("damage.dealt", {
            source: "autoAttack",
            weaponType: this.currentWeaponType,
            targetType: "monster",
            targetId: this.targetedEnemy.monsterType || this.targetedEnemy.id,
            damage: damage,
          });
        }

        // Update last attack time
        this.lastAttackTime = now;

        // Emit attack animation event
        eventBus.emit("player.attack.performed", {
          weaponType: this.currentWeaponType,
          targetPosition: {
            x: this.targetedEnemy.x,
            y: this.targetedEnemy.y,
          },
          damage: doesHit ? this.calculateDamage() : 0,
          didHit: doesHit,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error in performAttack:", error);
      return false;
    }
  }

  /**
   * Get the active game scene
   */
  private getGameScene(): any {
    try {
      // First try to get from the store
      const store = useGameStore.getState();
      const systems = store.systems || {};

      if (systems.gameScene) {
        return systems.gameScene;
      }

      // Fallback to window.game if available
      if (window.game?.scene?.scenes) {
        const scenes = window.game.scene.scenes.filter(
          (s: any) => s.key === "game" && s.sys?.isActive()
        );

        if (scenes.length > 0) {
          return scenes[0];
        }
      }

      // Fallback to specific scene key
      if (window.game?.scene) {
        const gameScene = window.game.scene.getScene("game");
        if (gameScene) {
          return gameScene;
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting game scene:", error);
      return null;
    }
  }

  /**
   * Calculate damage based on weapon and stats
   */
  private calculateDamage(): number {
    // Read from GameStore (single source of truth)
    const store = useGameStore.getState();
    const equipment = store.playerCharacter.equipment;
    const skills = store.playerCharacter.skills;

    // Use our new damage formula
    return DamageFormulas.calculatePlayerAutoAttackDamage(
      equipment,
      skills,
      this.currentWeaponType
    );
  }

  /**
   * Apply damage to the target
   */
  private applyDamageToTarget(damage: number): void {
    // Direct damage application if takeDamage is available
    if (this.targetedEnemy && typeof this.targetedEnemy.takeDamage === "function") {
      this.targetedEnemy.takeDamage(damage);
      return;
    }

    // Fallback to event emission
    eventBus.emit("monster.damage.taken", {
      targetId: this.targetedEnemy.id,
      damage: damage,
      source: "player",
      weaponType: this.currentWeaponType,
    });
  }

  /**
   * Check if auto-attack is currently active
   */
  isActive(): boolean {
    return this.isAutoAttacking && this.targetedEnemy !== null;
  }

  /**
   * Get the current target
   */
  getCurrentTarget(): any | null {
    return this.targetedEnemy;
  }

  /**
   * Get the current weapon type
   */
  getCurrentWeaponType(): string {
    return this.currentWeaponType;
  }

  /**
   * Update method to be called by the game loop
   */
  update(): void {
    // Perform attack if attacking
    if (this.isAutoAttacking && this.targetedEnemy) {
      this.performAttack();
    }
  }

  dispose(): void {
    // Clean up store subscription
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    // Clean up event listeners
    eventBus.off("monster.died", this.handleMonsterDeath);

    // Clear state
    this.clearTarget();
  }
}

// Add type definition for window.game
declare global {
  interface Window {
    game?: any;
  }
}

// Create and export singleton instance
export const autoAttackSystem = new AutoAttackSystemService();
