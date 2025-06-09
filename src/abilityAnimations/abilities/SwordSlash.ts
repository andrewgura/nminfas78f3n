import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class SwordSlashAbility extends BaseStrategy {
  // Default slash patterns for each direction
  private readonly PATTERNS: Record<string, number[][]> = {
    // When facing up, affect these tiles
    up: [
      [-1, -1],
      [0, -1],
      [1, -1], // 3 tiles in front of player
    ],
    // When facing right, affect these tiles
    right: [
      [1, -1],
      [1, 0],
      [1, 1], // 3 tiles to the right of player
    ],
    // When facing down, affect these tiles
    down: [
      [-1, 1],
      [0, 1],
      [1, 1], // 3 tiles below player
    ],
    // When facing left, affect these tiles
    left: [
      [-1, -1],
      [-1, 0],
      [-1, 1], // 3 tiles to the left of player
    ],
  };

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
      const effectDuration = config.effectDuration || 300;
      const debug = config.debug || false;
      const damage = ability.damage || 45;

      // Get the direction the player is facing
      const facing = playerCharacter.facing || "down"; // Default to down if not specified
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Get custom pattern from ability config or use default
      let pattern: number[][] = [];

      // First try to get from config.patterns
      if (config.patterns && typeof config.patterns === "object") {
        const customPatterns = config.patterns as Record<string, number[][]>;
        if (customPatterns[facing]) {
          pattern = customPatterns[facing];
        }
      }

      // Fall back to default patterns if not found in config
      if (pattern.length === 0 && this.PATTERNS[facing]) {
        pattern = this.PATTERNS[facing];
      }

      // If still no pattern, use a default
      if (pattern.length === 0) {
        pattern = this.PATTERNS.down;
        console.warn(`No pattern found for facing direction: ${facing}, using default.`);
      }

      if (debug) {
        console.log(`Sword Slash cast - Player facing: ${facing}`);
      }

      // Calculate the player's tile position
      const playerTileX = Math.floor(x / this.TILE_SIZE);
      const playerTileY = Math.floor(y / this.TILE_SIZE);

      if (debug) {
        console.log(`Player at tile: (${playerTileX}, ${playerTileY})`);
      }

      // Convert the pattern to world positions
      const worldPositions = this.convertPatternToWorldPositions(pattern, playerTileX, playerTileY);

      // Create slash arc effect
      this.createSlashEffect(
        scene,
        x,
        y,
        facingAngle,
        effectDuration,
        config,
        gameObjects,
        playerCharacter
      );

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
        console.log(`Sword Slash hit ${hitCount} monsters`);
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Use BaseStrategy's cleanup timer method
      this.setupCleanupTimer(scene, effectDuration, gameObjects, activeAnimations, ability.id);

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in SwordSlashAbility.play:", error);
      return Promise.resolve();
    }
  }

  protected createSlashEffect(
    scene: Phaser.Scene,
    x: number,
    y: number,
    facingAngle: number,
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[],
    playerChar: PlayerCharacter
  ): void {
    // Get config values or use defaults
    const slashColors = config.slashColors || [0xffffff, 0xeeeeee, 0xdddddd];
    const arcAngle = config.arcAngle || Math.PI / 2; // 90 degrees arc
    const slashRange = config.slashRange || 48;

    // Calculate the arc parameters
    const startAngle = facingAngle - arcAngle / 2;
    const endAngle = facingAngle + arcAngle / 2;

    // Create multiple arc slashes with slight timing differences
    for (let i = 0; i < 3; i++) {
      const slash = scene.add.graphics();
      slash.lineStyle(4 - i, slashColors[i], 0.8 - i * 0.2);
      slash.beginPath();
      slash.arc(x, y, slashRange - i * 4, startAngle, endAngle);
      slash.strokePath();
      slash.setDepth(6 + i);
      gameObjects.push(slash);

      // Animate each slash with slightly different timing
      scene.tweens.add({
        targets: slash,
        alpha: { from: 0.8 - i * 0.2, to: 0 },
        scale: { from: 0.8 + i * 0.1, to: 1.2 + i * 0.1 },
        delay: i * 30,
        duration: duration - i * 30,
        ease: "Sine.Out",
      });
    }

    // Create a sword trail effect (curved shape following the arc)
    const trailGraphics = scene.add.graphics();
    trailGraphics.fillStyle(0xffffff, 0.6);
    trailGraphics.beginPath();

    // Draw a curved shape along the arc path
    trailGraphics.moveTo(x, y);
    trailGraphics.lineTo(
      x + Math.cos(startAngle) * slashRange * 0.8,
      y + Math.sin(startAngle) * slashRange * 0.8
    );

    // Add curved path points
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (i / steps) * arcAngle;
      trailGraphics.lineTo(x + Math.cos(angle) * slashRange, y + Math.sin(angle) * slashRange);
    }

    trailGraphics.lineTo(
      x + Math.cos(endAngle) * slashRange * 0.8,
      y + Math.sin(endAngle) * slashRange * 0.8
    );
    trailGraphics.lineTo(x, y);
    trailGraphics.closePath();
    trailGraphics.fillPath();
    trailGraphics.setDepth(5);
    gameObjects.push(trailGraphics);

    // Fade out the trail
    scene.tweens.add({
      targets: trailGraphics,
      alpha: 0,
      duration: duration * 0.7,
      ease: "Sine.Out",
    });

    // Add impact sparkles at the edge of the slash
    for (let i = 0; i < 8; i++) {
      const sparkleAngle = startAngle + (i / 7) * arcAngle;
      const sparkleX = x + Math.cos(sparkleAngle) * slashRange;
      const sparkleY = y + Math.sin(sparkleAngle) * slashRange;

      // Create sparkle with random size
      const sparkleSize = 2 + Math.random() * 3;
      const sparkle = scene.add.circle(sparkleX, sparkleY, sparkleSize, 0xffffff, 0.9);
      sparkle.setDepth(7);
      gameObjects.push(sparkle);

      // Animate sparkle - fly outward slightly and fade
      const flyDistance = 10 + Math.random() * 10;
      const flyAngle = sparkleAngle;

      scene.tweens.add({
        targets: sparkle,
        x: sparkleX + Math.cos(flyAngle) * flyDistance,
        y: sparkleY + Math.sin(flyAngle) * flyDistance,
        alpha: 0,
        scale: { from: 1, to: 0.5 },
        duration: 400 + Math.random() * 200,
        ease: "Cubic.Out",
      });
    }

    // Add a brief screen shake for impact feel
    scene.cameras.main.shake(100, 0.002);

    // Player attack animation - more dynamic movement
    const lungeDistance = 8;
    scene.tweens.add({
      targets: playerChar,
      x: x + Math.cos(facingAngle) * lungeDistance,
      y: y + Math.sin(facingAngle) * lungeDistance,
      duration: duration / 3,
      ease: "Cubic.Out",
      onComplete: () => {
        // Return to original position
        scene.tweens.add({
          targets: playerChar,
          x: x,
          y: y,
          duration: duration / 2,
          ease: "Sine.InOut",
        });
      },
    });
  }

  protected createTileHighlights(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    // Get config values or use defaults
    const tileColor = config.tileColor || 0xffffff;

    positions.forEach((pos) => {
      // Create tile highlight
      const highlight = scene.add.rectangle(
        pos.x,
        pos.y,
        this.TILE_SIZE - 4,
        this.TILE_SIZE - 4,
        tileColor,
        0.3
      );
      highlight.setDepth(5);
      gameObjects.push(highlight);

      // Animate the highlight
      scene.tweens.add({
        targets: highlight,
        alpha: { from: 0.3, to: 0 },
        scale: { from: 0.8, to: 1.2 },
        duration: duration,
        ease: "Sine.Out",
      });
    });
  }
}
