import { Character } from "./Character";
import { MonsterAIComponent } from "./monster/MonsterAIComponent";
import { MonsterCombatComponent } from "./monster/MonsterCombatComponent";
import { MonsterDropComponent } from "./monster/MonsterDropComponent";
import { MonsterMovementComponent } from "./monster/MonsterMovementComponent";
import { HealthComponent } from "./HealthComponent";
import { eventBus } from "@/utils/EventBus";
import { MonsterDictionary } from "@/services/MonsterDictionaryService";
import { MonsterAnimationSystem } from "@/services/MonsterAnimationSystems";
import { MonsterData, MonsterAttackType } from "@/types";

export class Monster extends Character {
  monsterType!: string;
  monsterName!: string;
  experience!: number;
  facing: string = "down";
  isMoving: boolean = false;
  isAggressive: boolean = false;
  initialPosition: { x: number; y: number } = { x: 0, y: 0 };
  spriteSize: number = 64;
  private targetIndicator: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, monsterType: string) {
    // Get monster data from dictionary
    const monsterData = MonsterDictionary.getMonster(monsterType);

    // Determine sprite key
    const spriteKey = monsterData?.sprite ? monsterType : "monster-fallback";

    // Call parent constructor
    super(scene, x, y, spriteKey, monsterType);

    try {
      // Set monster properties
      this.monsterType = monsterType;
      this.monsterName = monsterData?.name || monsterType.replace(/-/g, " ");
      this.health = monsterData?.health || 100;
      this.maxHealth = monsterData?.maxHealth || 100;
      this.experience = monsterData?.experience || 10;
      this.isAggressive = monsterData?.isAggressive || false;
      this.spriteSize = monsterData?.spriteSize || 64;

      // Store initial position for non-aggressive wandering
      this.initialPosition = { x, y };

      // Set origin to center the sprite on the tile
      this.setOrigin(0.8, 0.8);

      // Add components
      this.addComponents(monsterData);

      // Emit monster created event
      eventBus.emit("monster.created", {
        id: this.id,
        type: this.monsterType,
        name: this.monsterName,
        position: { x: this.x, y: this.y },
        health: this.health,
        maxHealth: this.maxHealth,
        isAggressive: this.isAggressive,
      });
    } catch (error) {
      console.error(`Error creating monster ${monsterType}:`, error);
      eventBus.emit("error.monster.create", { type: monsterType, error });
    }
  }

  private addComponents(monsterData: MonsterData | null): void {
    try {
      // Health component
      this.components.add("health", new HealthComponent(this));

      // Combat component first, so we can get the attack type
      const combatComponent = new MonsterCombatComponent(
        this,
        monsterData?.damage || 5,
        monsterData?.attackType || "melee"
      );
      this.components.add("combat", combatComponent);

      // Movement component with correct distance behavior
      const movementComponent = new MonsterMovementComponent(
        this,
        monsterData?.speed || 100,
        monsterData?.isAggressive || false
      );

      // Set the preferred distance based on attack type
      movementComponent.setAttackTypeAndDistance(monsterData?.attackType || "melee");

      // Set initial position for wandering
      movementComponent.setInitialPosition(this.initialPosition.x, this.initialPosition.y);

      this.components.add("movement", movementComponent);

      // AI component
      const aiComponent = new MonsterAIComponent(
        this,
        monsterData?.isAggressive || false,
        monsterData?.attackType || "melee"
      );
      aiComponent.setRunawayPercent(monsterData?.runawayPercent || 0);
      this.components.add("ai", aiComponent);

      // Drop component
      const dropComponent = new MonsterDropComponent(this, monsterData?.drops || []);
      this.components.add("drop", dropComponent);
    } catch (error) {
      console.error(`Error adding components to monster ${this.monsterType}:`, error);
      eventBus.emit("error.monster.components", { id: this.id, type: this.monsterType, error });
    }
  }

  /**
   * Create and show a target indicator
   */
  showTargetIndicator(): void {
    // Remove any existing indicator
    this.hideTargetIndicator();

    // Create a new graphics object
    this.targetIndicator = this.scene.add.graphics();

    // Style with slightly thicker line and semi-transparent fill
    this.targetIndicator.lineStyle(3, 0xff0000, 0.8);
    this.targetIndicator.fillStyle(0xff0000, 0.15);

    // Calculate a better-fitting rectangle size (32x32 is the actual sprite size)
    const width = 32;
    const height = 32;

    // Draw rectangle that accounts for visual center
    const offsetX = (this.originX - 0.5) * width;
    const offsetY = (this.originY - 0.5) * height;
    this.targetIndicator.strokeRect(-width / 2 - offsetX, -height / 2 - offsetY, width, height);
    this.targetIndicator.fillRect(-width / 2 - offsetX, -height / 2 - offsetY, width, height);

    // Position indicator at the monster
    this.targetIndicator.x = this.x;
    this.targetIndicator.y = this.y;

    // Set depth to be just below monster
    this.targetIndicator.setDepth(this.depth - 0.1);

    // Add a pulse animation with modified timing
    this.scene.tweens.add({
      targets: this.targetIndicator,
      alpha: { from: 0.85, to: 0.5 },
      duration: 600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Hide the target indicator
   */
  hideTargetIndicator(): void {
    if (this.targetIndicator) {
      this.targetIndicator.destroy();
      this.targetIndicator = null;
    }
  }

  /**
   * Update the position of the target indicator
   */
  updateTargetIndicatorPosition(): void {
    if (this.targetIndicator) {
      this.targetIndicator.x = this.x;
      this.targetIndicator.y = this.y;
    }
  }

  playAnimation(direction?: string, isMoving?: boolean): void {
    try {
      if (this.isDead) return;

      // Update facing direction if specified
      if (direction) {
        this.facing = direction;
      }

      // Update movement state if specified
      if (typeof isMoving !== "undefined") {
        this.isMoving = isMoving;
      }

      // Use the animation system to play the appropriate animation
      MonsterAnimationSystem.playAnimation(
        this,
        this.monsterType,
        this.facing,
        this.isMoving,
        this.spriteSize
      );

      // Emit animation event for React
      eventBus.emit("monster.animation", {
        id: this.id,
        type: this.monsterType,
        direction: this.facing,
        isMoving: this.isMoving,
      });
    } catch (error) {
      console.error(`Error playing animation for monster ${this.id}:`, error);
      eventBus.emit("error.monster.animation", { id: this.id, error });
    }
  }

  takeDamage(amount: number): boolean {
    try {
      // Monster-specific behavior before damage
      const aiComponent = this.components.get<MonsterAIComponent>("ai");
      if (aiComponent) {
        aiComponent.setProvokedState(true);
      }

      // Store current alpha
      const originalAlpha = this.alpha;

      // Flash red when taking damage - ensure alpha is properly restored
      this.scene.tweens.add({
        targets: this,
        alpha: 0.6,
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

      // Emit monster damage event
      eventBus.emit("monster.damage", {
        id: this.id,
        type: this.monsterType,
        amount: amount,
        currentHealth: this.health - amount,
      });

      // Apply damage via parent method
      return super.takeDamage(amount);
    } catch (error) {
      console.error(`Error applying damage to monster ${this.id}:`, error);
      eventBus.emit("error.monster.damage", { id: this.id, error });
      return false;
    }
  }

  die(): void {
    try {
      if (this.isDead) return;

      // Call parent method to set isDead flag
      super.die();

      // Stop all AI components immediately
      const aiComponent = this.components.get<MonsterAIComponent>("ai");
      if (aiComponent) {
        aiComponent.disable();
      }

      // Completely disable physics body
      if (this.body) {
        (this.body as Phaser.Physics.Arcade.Body).checkCollision.none = true;
        this.body.enable = false;
      }

      // Remove from monsters group immediately
      const gameScene = this.scene as any;
      if (gameScene.monsters) {
        gameScene.monsters.remove(this, false);
      }

      // Remember position for drops
      const monsterX = this.x;
      const monsterY = this.y;

      // Ensure destruction happens even if animation fails
      let destroyCalled = false;

      // Ensure destruction happens even if animation fails
      const safetyTimer = this.scene.time.delayedCall(600, () => {
        if (!destroyCalled) {
          this.finalCleanup(monsterX, monsterY);
          destroyCalled = true;
        }
      });

      // Play death animation
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 0.8,
        scaleY: 0.8,
        duration: 500,
        ease: "Power2",
        onComplete: () => {
          safetyTimer.remove();
          if (!destroyCalled) {
            this.finalCleanup(monsterX, monsterY);
            destroyCalled = true;
          }
        },
      });
    } catch (error) {
      console.error(`Error in monster ${this.id} die method:`, error);
      eventBus.emit("error.monster.die", { id: this.id, error });
      this.destroy(); // Ensure destruction even if error occurs
    }
  }

  private finalCleanup(monsterX: number, monsterY: number): void {
    try {
      // Process drops
      const dropComponent = this.components.get<MonsterDropComponent>("drop");
      if (dropComponent) {
        dropComponent.processDrops(monsterX, monsterY);
      }

      // Emit death event with experience
      eventBus.emit("monster.died", {
        type: this.monsterType,
        name: this.monsterName,
        x: monsterX,
        y: monsterY,
        experience: this.experience,
      });

      // Final destruction
      this.destroy();
    } catch (error) {
      console.error(`Error in finalCleanup for monster ${this.id}:`, error);
      eventBus.emit("error.monster.cleanup", { id: this.id, error });
      this.destroy(); // Ensure destruction even if error occurs
    }
  }

  update(time: number, delta: number): void {
    try {
      super.update(time, delta);

      // Update target indicator position if visible
      if (this.targetIndicator) {
        this.updateTargetIndicatorPosition();
      }

      // Update facing direction based on movement if needed
      const movementComponent = this.components.get<MonsterMovementComponent>("movement");
      if (movementComponent) {
        this.isMoving = movementComponent.isMoving;

        // If moving, update facing direction based on velocity
        if (
          this.isMoving &&
          this.body &&
          (this.body.velocity.x !== 0 || this.body.velocity.y !== 0)
        ) {
          const vx = this.body.velocity.x;
          const vy = this.body.velocity.y;

          if (Math.abs(vx) > Math.abs(vy)) {
            // Horizontal movement dominates
            this.facing = vx > 0 ? "right" : "left";
          } else {
            // Vertical movement dominates
            this.facing = vy > 0 ? "down" : "up";
          }
        }

        // Play appropriate animation
        this.playAnimation();
      }
    } catch (error) {
      console.error(`Error in monster ${this.id} update:`, error);
      eventBus.emit("error.monster.update", { id: this.id, error });
    }
  }

  destroy(): void {
    try {
      // Clean up the target indicator
      if (this.targetIndicator) {
        this.targetIndicator.destroy();
        this.targetIndicator = null;
      }

      // Call the parent destroy method
      super.destroy();
    } catch (error) {
      console.error(`Error destroying monster ${this.id}:`, error);
      eventBus.emit("error.monster.destroy", { id: this.id, error });
    }
  }
}
