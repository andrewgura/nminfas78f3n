import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { Monster } from "@/entities/Monster";

export class PowerShotAbility extends BaseStrategy {
  private hitMonsters = new Set<Monster>();

  async play(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    x: number,
    y: number,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void> {
    if (!scene || !playerCharacter) return;

    try {
      // Clear hit monsters for this shot
      this.hitMonsters.clear();

      const gameObjects: Phaser.GameObjects.GameObject[] = [];
      const config = ability.animationConfig || {};
      const effectDuration = config.effectDuration || 800;
      const damage = ability.damage || 12;

      // Get facing direction
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Create and launch projectile
      await this.createPiercingProjectile(
        scene,
        playerCharacter,
        x,
        y,
        facingAngle,
        ability,
        config,
        gameObjects,
        activeAnimations
      );

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Set up cleanup timer
      scene.time.delayedCall(effectDuration, () => {
        gameObjects.forEach((obj) => {
          if (obj.active) obj.destroy();
        });
        activeAnimations.delete(ability.id);
      });

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in PowerShotAbility.play:", error);
      return Promise.resolve();
    }
  }

  protected async createPiercingProjectile(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    x: number,
    y: number,
    facingAngle: number,
    ability: Ability,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[],
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void> {
    try {
      const range = ability.range || 384; // 12 tiles at 32px per tile
      const speed = config.projectileSpeed || 500;
      const damage = ability.damage || 12;
      const effectDuration = config.effectDuration || 800;

      // Calculate end point of the shot (max range)
      const endX = x + Math.cos(facingAngle) * range;
      const endY = y + Math.sin(facingAngle) * range;

      // Create arrow/projectile graphics
      const projectile = scene.add.graphics();
      projectile.fillStyle(0xffffff, 0.8);
      projectile.lineStyle(2, 0x333333, 0.8);
      projectile.setDepth(6);
      gameObjects.push(projectile);

      // Draw the arrow shape - base of the object is at (0,0)
      this.drawArrow(projectile, facingAngle);

      // Position at player's location
      projectile.x = x;
      projectile.y = y;
      projectile.rotation = facingAngle;

      // Create trail effect
      const trail = scene.add.graphics();
      trail.fillStyle(0xdddddd, 0.5);
      trail.setDepth(5);
      gameObjects.push(trail);

      // Calculate duration based on range and speed
      const flightDuration = (range / speed) * 1000;

      // Return a promise that resolves when the animation completes
      return new Promise<void>((resolve) => {
        // This tween animates the projectile along its path
        scene.tweens.add({
          targets: projectile,
          x: endX,
          y: endY,
          duration: flightDuration,
          ease: "Linear",
          onUpdate: (tween) => {
            try {
              // Calculate current position on the path
              const progress = tween.getValue();
              const currentX = x + (endX - x) * progress;
              const currentY = y + (endY - y) * progress;

              // Draw trail
              trail.fillCircle(currentX, currentY, 3);

              // Check for hits with monsters at current position
              this.checkForMonsterHits(scene, currentX, currentY, facingAngle, damage);
            } catch (error) {
              console.error("Error in projectile onUpdate:", error);
            }
          },
          onComplete: () => {
            // Clean up after animation completes
            scene.time.delayedCall(200, () => {
              // Fade out trail
              scene.tweens.add({
                targets: trail,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                  resolve();
                },
              });
            });
          },
        });
      });
    } catch (error) {
      console.error("Error in PowerShotAbility.createPiercingProjectile:", error);
      return Promise.resolve();
    }
  }

  private drawArrow(graphics: Phaser.GameObjects.Graphics, angle: number): void {
    try {
      // Draw arrow shape
      graphics.clear();

      // Arrow shaft
      graphics.fillRect(-5, -2, 20, 4);

      // Arrow head
      graphics.beginPath();
      graphics.moveTo(15, 0); // Tip of arrow
      graphics.lineTo(10, -6); // Left side
      graphics.lineTo(10, 6); // Right side
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();

      // Small fletching at back
      graphics.beginPath();
      graphics.moveTo(-5, 0); // Back of arrow
      graphics.lineTo(-10, -5); // Top of fletching
      graphics.lineTo(-5, -1); // Back to shaft
      graphics.closePath();
      graphics.fillPath();

      graphics.beginPath();
      graphics.moveTo(-5, 0); // Back of arrow
      graphics.lineTo(-10, 5); // Bottom of fletching
      graphics.lineTo(-5, 1); // Back to shaft
      graphics.closePath();
      graphics.fillPath();
    } catch (error) {
      console.error("Error drawing arrow:", error);
    }
  }

  private checkForMonsterHits(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    damage: number
  ): void {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return;

      const monsters = gameScene.monsters.getChildren() as Monster[];
      const hitDistance = 20; // Detection radius

      monsters.forEach((monster) => {
        // Skip if already hit by this ability or not active
        if (this.hitMonsters.has(monster) || !monster.active) return;

        // Calculate distance to monster
        const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);

        if (distance <= hitDistance) {
          // Register hit
          if (monster.takeDamage) {
            monster.takeDamage(damage);
            // Use BaseStrategy's showDamageEffect instead of reimplementing it
            this.showDamageEffect(scene, monster, damage);

            // Add to hit monsters so we don't hit it again
            this.hitMonsters.add(monster);

            // Create hit effect using BaseStrategy method
            this.createHitEffect(scene, monster);
          }
        }
      });
    } catch (error) {
      console.error("Error checking for monster hits:", error);
    }
  }
}
