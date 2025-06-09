import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class BoneSpikeAbility extends BaseStrategy {
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
      const gameObjects: Phaser.GameObjects.GameObject[] = [];
      const config = ability.animationConfig || {};
      const effectDuration = config.effectDuration || 1500;
      const damage = ability.damage || 15;

      // Create bone spike visual and animation
      this.createBoneSpikeEffect(scene, x, y, effectDuration, config, gameObjects, playerCharacter);

      // Apply damage to monsters in the affected area
      const hitRadius = config.hitRadius || 96;
      this.applyDamageInCircle(scene, x, y, hitRadius, damage, null, config.debug);

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Use BaseStrategy's cleanup method
      this.setupCleanupTimer(scene, effectDuration, gameObjects, activeAnimations, ability.id);

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in BoneSpikeAbility.play:", error);
      return Promise.resolve();
    }
  }

  protected createBoneSpikeEffect(
    scene: Phaser.Scene,
    x: number,
    y: number,
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[],
    playerCharacter: PlayerCharacter
  ): void {
    try {
      // Get config values or use defaults
      const colors = config.particleColors || [0xffffff, 0xf0f0f0, 0xe0e0e0];
      const spikeCount = config.spikeCount || 5;
      const pulseDelay = config.pulseDelay || 700;

      // Create a ground crack effect first
      const groundCrack = scene.add.graphics();
      groundCrack.lineStyle(3, 0x333333, 0.8);
      groundCrack.setDepth(4);
      gameObjects.push(groundCrack);

      // Draw 4-5 random cracks
      const crackCount = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < crackCount; i++) {
        const startAngle = Math.random() * Math.PI * 2;
        const crackLength = 20 + Math.random() * 40;

        // Create a jagged line with 2-3 segments
        let currentX = x;
        let currentY = y;
        let currentAngle = startAngle;

        groundCrack.beginPath();
        groundCrack.moveTo(currentX, currentY);

        const segments = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < segments; j++) {
          // Slightly adjust angle for each segment
          currentAngle += Math.random() * 0.8 - 0.4;
          const segmentLength = crackLength / segments;

          currentX += Math.cos(currentAngle) * segmentLength;
          currentY += Math.sin(currentAngle) * segmentLength;

          groundCrack.lineTo(currentX, currentY);
        }

        groundCrack.strokePath();
      }

      // Animate ground cracks appearing
      scene.tweens.add({
        targets: groundCrack,
        alpha: { from: 0, to: 0.8 },
        duration: 200,
        onComplete: () => {
          // After ground cracks appear, show the spikes after a delay
          scene.time.delayedCall(pulseDelay, () => {
            // Create the bone spikes
            for (let i = 0; i < spikeCount; i++) {
              this.createSingleSpike(scene, x, y, i, spikeCount, colors, gameObjects, duration);
            }
          });
        },
      });

      // Add a subtle screen shake
      scene.cameras.main.shake(200, 0.003);
    } catch (error) {
      console.error("Error in BoneSpikeAbility.createBoneSpikeEffect:", error);
    }
  }

  protected createSingleSpike(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    index: number,
    totalSpikes: number,
    colors: number[],
    gameObjects: Phaser.GameObjects.GameObject[],
    duration: number
  ): void {
    try {
      // Calculate position in a circle around the center
      const angle = (index / totalSpikes) * Math.PI * 2;
      const distance = Math.random() * 40 + 20; // Random distance from center
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      // Create spike graphics
      const spike = scene.add.graphics();
      spike.fillStyle(colors[0], 0.9);
      spike.setDepth(6);
      gameObjects.push(spike);

      // Draw a triangular spike
      const spikeHeight = 30 + Math.random() * 20; // Random height
      const spikeWidth = 10 + Math.random() * 5; // Random width
      const spikeAngle = angle + Math.PI / 2; // Point spike upward

      // Start with spike underground
      spike.y = spikeHeight;

      // Spike coordinates
      const points = [
        { x: x, y: y }, // Tip
        {
          x: x - Math.cos(spikeAngle - Math.PI / 6) * spikeWidth,
          y: y - Math.sin(spikeAngle - Math.PI / 6) * spikeWidth,
        }, // Bottom left
        {
          x: x - Math.cos(spikeAngle + Math.PI / 6) * spikeWidth,
          y: y - Math.sin(spikeAngle + Math.PI / 6) * spikeWidth,
        }, // Bottom right
      ];

      // Draw the spike
      spike.beginPath();
      spike.moveTo(points[0].x, points[0].y);
      spike.lineTo(points[1].x, points[1].y);
      spike.lineTo(points[2].x, points[2].y);
      spike.closePath();
      spike.fillPath();

      // Add spike outline
      spike.lineStyle(2, 0x333333, 0.7);
      spike.beginPath();
      spike.moveTo(points[0].x, points[0].y);
      spike.lineTo(points[1].x, points[1].y);
      spike.lineTo(points[2].x, points[2].y);
      spike.closePath();
      spike.strokePath();

      // Animate spike rising and falling
      scene.tweens.add({
        targets: spike,
        y: 0, // Rise to ground level
        duration: 200,
        ease: "Cubic.Out",
        onComplete: () => {
          // Hold for a moment then retract
          scene.time.delayedCall(duration - 500, () => {
            scene.tweens.add({
              targets: spike,
              y: spikeHeight, // Back underground
              alpha: 0,
              duration: 300,
              ease: "Cubic.In",
            });
          });
        },
      });

      // Create small debris particles
      for (let j = 0; j < 3; j++) {
        const debrisX = x + (Math.random() - 0.5) * 20;
        const debrisY = y + (Math.random() - 0.5) * 20;
        const debris = scene.add.circle(debrisX, debrisY, 2 + Math.random() * 2, 0xe0e0e0, 0.7);
        debris.setDepth(5);
        gameObjects.push(debris);

        // Animate debris flying outward
        scene.tweens.add({
          targets: debris,
          x: debrisX + (Math.random() - 0.5) * 30,
          y: debrisY + (Math.random() - 0.5) * 30,
          alpha: 0,
          duration: 500 + Math.random() * 300,
          ease: "Cubic.Out",
        });
      }
    } catch (error) {
      console.error("Error in BoneSpikeAbility.createSingleSpike:", error);
    }
  }
}
