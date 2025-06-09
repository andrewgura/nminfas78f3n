import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { eventBus } from "@/utils/EventBus";

export class WhirlwindAbility extends BaseStrategy {
  // Default Whirlwind pattern - all 8 surrounding tiles
  private readonly DEFAULT_PATTERN: number[][] = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

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
      const effectDuration = config.effectDuration || 800;
      const debug = config.debug || false;
      const damage = ability.damage || 46;

      // Get custom pattern from ability config or use default
      let pattern = this.DEFAULT_PATTERN;
      if (config.pattern && Array.isArray(config.pattern)) {
        pattern = config.pattern;
      }

      if (debug) {
        console.log(`Whirlwind cast at (${x}, ${y})`);
      }

      // Calculate the player's tile position
      const playerTileX = Math.floor(x / this.TILE_SIZE);
      const playerTileY = Math.floor(y / this.TILE_SIZE);

      // Convert the pattern to world positions
      const worldPositions = this.convertPatternToWorldPositions(pattern, playerTileX, playerTileY);

      // Create the circular whirlwind effect
      this.createWhirlwindEffect(scene, x, y, effectDuration, config, gameObjects, playerCharacter);

      // Create tile highlights
      this.createTileHighlights(scene, worldPositions, effectDuration, config, gameObjects);

      // Create debug visualization if requested
      if (debug) {
        const debugGraphics = this.createDebugVisualization(scene, worldPositions);
        gameObjects.push(debugGraphics);
      }

      // Apply damage to monsters in the affected tiles
      const hitCount = this.applyDamageToMonstersInTiles(scene, worldPositions, damage, debug);

      if (debug) {
        console.log(`Whirlwind hit ${hitCount} monsters using tile pattern`);
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Use BaseStrategy's cleanup method
      this.setupCleanupTimer(scene, effectDuration, gameObjects, activeAnimations, ability.id);

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in WhirlwindAbility.play:", error);
      return Promise.resolve();
    }
  }

  protected createWhirlwindEffect(
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
      const colors = config.colors || [0xeeeeee, 0xdddddd, 0xcccccc, 0xaaaaaa];
      const radius = config.radius || 64;

      // Create multiple rotating circles with staggered timing
      for (let i = 0; i < 3; i++) {
        // Create a ring with stroke
        const ring = scene.add.circle(x, y, radius - i * 8, colors[i % colors.length], 0.05);
        ring.setStrokeStyle(3 - i * 0.5, colors[i % colors.length], 0.7 - i * 0.1);
        ring.setDepth(5);
        gameObjects.push(ring);

        // Add a delayed rotation animation
        scene.tweens.add({
          targets: ring,
          angle: i % 2 === 0 ? 360 : -360, // Alternate directions
          scale: { from: 0.5, to: 1.2 },
          alpha: { from: 0.8, to: 0 },
          delay: i * 100,
          duration: duration - i * 100,
          ease: "Sine.InOut",
        });
      }

      // Create a dust cloud at the base
      const dustCloud = scene.add.circle(x, y, radius * 0.9, 0xdddddd, 0.2);
      dustCloud.setDepth(4);
      gameObjects.push(dustCloud);

      scene.tweens.add({
        targets: dustCloud,
        scale: { from: 0.8, to: 1.3 },
        alpha: { from: 0.2, to: 0 },
        duration: duration,
        ease: "Sine.Out",
      });

      // Add screen shake
      scene.cameras.main.shake(duration * 0.4, 0.003);

      // Create the rotating slice effects
      const slices = scene.add.graphics();
      slices.setDepth(6);
      gameObjects.push(slices);

      // Draw and animate multiple slices
      let sliceFrame = 0;
      const sliceEvent = scene.time.addEvent({
        delay: 1000 / 30, // 30fps
        callback: () => {
          sliceFrame++;
          slices.clear();

          // Draw 4 slices rotating over time
          for (let i = 0; i < 4; i++) {
            const sliceAngle = (sliceFrame * 5 + i * 90) * (Math.PI / 180);
            const sliceLength = radius * 0.9;

            slices.lineStyle(5 - i, colors[0], 0.7 - i * 0.15);
            slices.beginPath();
            slices.moveTo(x, y);
            slices.lineTo(
              x + Math.cos(sliceAngle) * sliceLength,
              y + Math.sin(sliceAngle) * sliceLength
            );
            slices.strokePath();

            // Add a small shape at the end of each slice
            const endX = x + Math.cos(sliceAngle) * sliceLength;
            const endY = y + Math.sin(sliceAngle) * sliceLength;

            slices.fillStyle(colors[0], 0.6 - i * 0.1);
            slices.fillCircle(endX, endY, 4 - i * 0.8);
          }
        },
        callbackScope: this,
        repeat: Math.floor(duration / (1000 / 30)),
      });

      // Store the event with the slices object for cleanup
      (slices as any).sliceEvent = sliceEvent;

      // Create particles that spiral outward
      for (let i = 0; i < 20; i++) {
        const delay = Math.random() * 400;

        scene.time.delayedCall(delay, () => {
          const angle = Math.random() * Math.PI * 2;
          const startDistance = 10;
          const particleX = x + Math.cos(angle) * startDistance;
          const particleY = y + Math.sin(angle) * startDistance;

          const particle = scene.add.circle(
            particleX,
            particleY,
            3,
            colors[Math.floor(Math.random() * colors.length)],
            0.8
          );
          particle.setDepth(6);
          gameObjects.push(particle);

          // Calculate end position - spinning outward
          const spinAngle = angle + Math.PI * (Math.random() > 0.5 ? 0.5 : -0.5); // 90 degree spin
          const endDistance = radius * (0.7 + Math.random() * 0.6);
          const endX = x + Math.cos(spinAngle) * endDistance;
          const endY = y + Math.sin(spinAngle) * endDistance;

          scene.tweens.add({
            targets: particle,
            x: endX,
            y: endY,
            scale: { from: 1, to: 0.5 + Math.random() * 0.5 },
            alpha: 0,
            duration: 500 + Math.random() * 300,
            ease: "Cubic.Out",
          });
        });
      }
    } catch (error) {
      console.error("Error in WhirlwindAbility.createWhirlwindEffect:", error);
      eventBus.emit("error.ability.whirlwind.effect", { error });
    }
  }

  protected createTileHighlights(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Get config values or use defaults
      const color = config.color || 0xffffff;

      positions.forEach((pos) => {
        // Create tile highlight
        const highlight = scene.add.rectangle(
          pos.x,
          pos.y,
          this.TILE_SIZE - 4,
          this.TILE_SIZE - 4,
          color,
          0.4
        );
        highlight.setDepth(4);
        gameObjects.push(highlight);

        // Animate the highlight
        scene.tweens.add({
          targets: highlight,
          alpha: { from: 0.4, to: 0 },
          scale: { from: 0.8, to: 1.2 },
          duration: duration,
          ease: "Sine.InOut",
        });

        // Add a simple particle effect
        const particle = scene.add.circle(pos.x, pos.y, 3, color, 0.7);
        particle.setDepth(6);
        gameObjects.push(particle);

        // Animate the particle in a spiral
        const startAngle = Math.random() * Math.PI * 2;
        let angle = startAngle;

        scene.tweens.add({
          targets: particle,
          scale: { from: 1, to: 0.5 },
          alpha: { from: 0.7, to: 0 },
          duration: duration,
          ease: "Sine.InOut",
          onUpdate: (tween) => {
            try {
              const progress = tween.getValue();
              angle += 0.1; // Rotate particle
              const distance = 10 * (1 - progress); // Spiral inward
              particle.x = pos.x + Math.cos(angle) * distance;
              particle.y = pos.y + Math.sin(angle) * distance;
            } catch (error) {
              // Silent fail for update errors
            }
          },
        });
      });
    } catch (error) {
      console.error("Error in WhirlwindAbility.createTileHighlights:", error);
      eventBus.emit("error.ability.whirlwind.highlights", { error });
    }
  }

  getObjectTypesForPositioning(): string[] {
    return []; // No objects need repositioning
  }
}
