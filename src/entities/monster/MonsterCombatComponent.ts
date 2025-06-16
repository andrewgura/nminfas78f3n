import { Component } from "../Component";
import { Monster } from "../Monster";
import { MonsterMovementComponent } from "./MonsterMovementComponent";
import { DamageFormulas } from "@/utils/formulas"; // ADDED: Only new import
import { eventBus } from "@/utils/EventBus";

export class MonsterCombatComponent extends Component {
  damage: number = 5;
  attackRange: number = 32;
  attackCooldown: number = 2000;
  lastAttackTime: number = 0;
  attackType: string = "melee"; // "melee", "ranged", or "magic"

  constructor(entity: Monster, damage: number = 5, attackType: string = "melee") {
    super(entity);
    this.damage = damage;
    this.attackType = attackType;

    // Set attack range based on attack type
    if (this.attackType === "melee") {
      this.attackRange = 40; // ~1.25 tiles
    } else if (this.attackType === "ranged") {
      this.attackRange = 384; // 12 tiles
    } else if (this.attackType === "magic") {
      this.attackRange = 384; // 12 tiles
    }

    // Emit initialization event
    eventBus.emit("monster.combat.initialized", {
      entityId: this.entity.id,
      damage: this.damage,
      attackType: this.attackType,
      attackRange: this.attackRange,
      attackCooldown: this.attackCooldown,
    });
  }

  get monster(): Monster {
    return this.entity as Monster;
  }

  attackPlayerCharacter(): boolean {
    try {
      if (Date.now() - this.lastAttackTime < this.attackCooldown) {
        return false;
      }

      // Get player character
      const gameScene = this.entity.scene as any;
      if (!gameScene.playerCharacter) return false;

      const player = gameScene.playerCharacter;

      // Check if player is in range
      const distance = Phaser.Math.Distance.Between(
        this.entity.x,
        this.entity.y,
        player.x,
        player.y
      );

      if (distance > this.attackRange) {
        return false; // Player out of range
      }

      // Update last attack time
      this.lastAttackTime = Date.now();

      // Calculate direction to player for facing during attack
      const dx = player.x - this.entity.x;
      const dy = player.y - this.entity.y;

      let direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }

      // Make sure the monster is facing the player when attacking
      const movementComponent = this.monster.components.get<MonsterMovementComponent>("movement");
      if (movementComponent) {
        movementComponent.facePlayer();
      } else {
        // Fallback if no movement component
        this.monster.playAnimation(direction, false);
      }

      // Flash the monster briefly to indicate attack
      this.entity.setTint(0xff0000);
      this.entity.scene.time.delayedCall(100, () => {
        this.entity.setTint(this.entity.color);
      });

      // Create attack effect
      this.createAttackEffect(player.x, player.y);

      // CHANGED: Calculate damage using formulas and determine if magic
      const finalDamage = DamageFormulas.calculateMonsterDamage(this.damage, 1);
      const isMagicDamage = DamageFormulas.isMagicDamage(this.attackType);

      // CHANGED: Call player's takeDamage method with calculated damage and magic flag
      player.takeDamage(finalDamage, isMagicDamage);

      // Emit attack event
      eventBus.emit("monster.attack.hit", {
        entityId: this.entity.id,
        targetId: "player",
        damage: finalDamage, // CHANGED: Use calculated damage
        attackType: this.attackType,
        direction: direction,
      });

      return true;
    } catch (error) {
      console.error(`Error in monster ${this.entity.id} attackPlayerCharacter:`, error);
      eventBus.emit("error.monster.attack", {
        entityId: this.entity.id,
        error,
      });
      return false;
    }
  }

  createDamageText(x: number, y: number, damage: number): void {
    try {
      const text = this.entity.scene.add.text(x, y - 20, `-${damage}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
      });

      text.setOrigin(0.5);
      text.setDepth(100);

      this.entity.scene.tweens.add({
        targets: text,
        y: y - 40,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          text.destroy();
        },
      });
    } catch (error) {
      console.error(`Error creating damage text for monster ${this.entity.id}:`, error);
    }
  }

  createAttackEffect(targetX: number, targetY: number): void {
    try {
      if (this.attackType === "melee") {
        // Simple slash effect
        const angle = Phaser.Math.Angle.Between(this.entity.x, this.entity.y, targetX, targetY);
        const distance = 32; // 1 tile
        const effectX = this.entity.x + Math.cos(angle) * distance;
        const effectY = this.entity.y + Math.sin(angle) * distance;

        const slash = this.entity.scene.add.rectangle(effectX, effectY, 20, 5, 0xffffff, 0.7);
        slash.rotation = angle;
        slash.setDepth(6);

        this.entity.scene.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 200,
          onComplete: () => {
            slash.destroy();
          },
        });

        // Emit melee effect event
        eventBus.emit("monster.attack.effect", {
          entityId: this.entity.id,
          attackType: "melee",
          position: { x: effectX, y: effectY },
        });
      } else if (this.attackType === "ranged") {
        // Arrow projectile
        const angle = Phaser.Math.Angle.Between(this.entity.x, this.entity.y, targetX, targetY);
        const arrow = this.entity.scene.add.rectangle(this.entity.x, this.entity.y, 8, 2, 0xdddddd);
        arrow.rotation = angle;
        arrow.setDepth(6);

        // Emit projectile start event
        eventBus.emit("monster.attack.projectile", {
          entityId: this.entity.id,
          attackType: "ranged",
          startPosition: { x: this.entity.x, y: this.entity.y },
          targetPosition: { x: targetX, y: targetY },
          angle: angle,
        });

        this.entity.scene.tweens.add({
          targets: arrow,
          x: targetX,
          y: targetY,
          duration: 300,
          onComplete: () => {
            arrow.destroy();

            // Add impact effect
            const impact = this.entity.scene.add.circle(targetX, targetY, 5, 0xffffff, 0.7);
            impact.setDepth(6);
            this.entity.scene.tweens.add({
              targets: impact,
              alpha: 0,
              scale: 2,
              duration: 150,
              onComplete: () => {
                impact.destroy();
              },
            });

            // Emit impact event
            eventBus.emit("monster.attack.impact", {
              entityId: this.entity.id,
              attackType: "ranged",
              position: { x: targetX, y: targetY },
            });
          },
        });
      } else if (this.attackType === "magic") {
        // Magic bolt
        const bolt = this.entity.scene.add.circle(this.entity.x, this.entity.y, 6, 0x00aaff, 0.8);
        bolt.setDepth(6);

        // Add a glow
        const glow = this.entity.scene.add.circle(this.entity.x, this.entity.y, 10, 0x00aaff, 0.4);
        glow.setDepth(5);

        // Emit projectile start event
        eventBus.emit("monster.attack.projectile", {
          entityId: this.entity.id,
          attackType: "magic",
          startPosition: { x: this.entity.x, y: this.entity.y },
          targetPosition: { x: targetX, y: targetY },
        });

        this.entity.scene.tweens.add({
          targets: [bolt, glow],
          x: targetX,
          y: targetY,
          duration: 400,
          onComplete: () => {
            bolt.destroy();
            glow.destroy();

            // Create impact effect
            const impact = this.entity.scene.add.circle(targetX, targetY, 15, 0x00aaff, 0.6);
            impact.setDepth(6);
            this.entity.scene.tweens.add({
              targets: impact,
              alpha: 0,
              scale: 2,
              duration: 300,
              onComplete: () => {
                impact.destroy();
              },
            });

            // Emit impact event
            eventBus.emit("monster.attack.impact", {
              entityId: this.entity.id,
              attackType: "magic",
              position: { x: targetX, y: targetY },
            });
          },
        });
      }
    } catch (error) {
      console.error(`Error creating attack effect for monster ${this.entity.id}:`, error);
      eventBus.emit("error.monster.attack.effect", {
        entityId: this.entity.id,
        error,
      });
    }
  }
}
