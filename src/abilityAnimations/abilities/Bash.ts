import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class BashAbility extends BaseStrategy {
  // Default bash pattern - tiles directly in front of the player
  private readonly PATTERNS: Record<string, number[][]> = {
    up: [
      [0, -1], // One tile directly above player
    ],
    right: [
      [1, 0], // One tile directly to the right
    ],
    down: [
      [0, 1], // One tile directly below
    ],
    left: [
      [-1, 0], // One tile directly to the left
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
      const effectDuration = config.effectDuration || 350; // Slightly faster for punchier feel
      const debug = config.debug || false;
      const damage = ability.damage || 30;

      // Get the direction the player is facing
      const facing = playerCharacter.facing || "down";
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
        console.log(`Bash cast - Player facing: ${facing}`);
      }

      // Calculate the player's tile position
      const playerTileX = Math.floor(x / this.TILE_SIZE);
      const playerTileY = Math.floor(y / this.TILE_SIZE);

      // Convert the pattern to world positions
      const worldPositions = this.convertPatternToWorldPositions(pattern, playerTileX, playerTileY);

      // Create bash visual effect
      this.createBashEffect(
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
        console.log(`Bash hit ${hitCount} monsters using tile pattern`);
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
      console.error("Error in BashAbility.play:", error);
      return Promise.resolve();
    }
  }

  /**
   * Creates the bash visual effect with enhanced visuals
   */
  protected createBashEffect(
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
    const bashColor = config.bashColor || 0xeeddaa; // Warmer gold/bronze for bash
    const effectSize = config.effectSize || 32;

    // Calculate target position in front of player
    const targetX = x + Math.cos(facingAngle) * effectSize;
    const targetY = y + Math.sin(facingAngle) * effectSize;

    // Add pre-bash effect (player drawing back)
    const preEffectDistance = 10;
    scene.tweens.add({
      targets: playerChar,
      x: x - Math.cos(facingAngle) * preEffectDistance,
      y: y - Math.sin(facingAngle) * preEffectDistance,
      duration: duration * 0.2,
      ease: "Power2Out",
      onComplete: () => {
        // Forward bash motion (more powerful)
        scene.tweens.add({
          targets: playerChar,
          x: x + Math.cos(facingAngle) * (preEffectDistance * 0.8),
          y: y + Math.sin(facingAngle) * (preEffectDistance * 0.8),
          duration: duration * 0.15,
          ease: "Power1In",
          onComplete: () => {
            // Return to original position
            scene.tweens.add({
              targets: playerChar,
              x: x,
              y: y,
              duration: duration * 0.4,
              ease: "Sine.Out",
            });
          },
        });
      },
    });

    // Create shockwave ring
    const shockwave = scene.add.circle(targetX, targetY, effectSize * 0.4, bashColor, 0.7);
    shockwave.setDepth(6);
    gameObjects.push(shockwave);

    // Animate the shockwave - expanding ring
    scene.tweens.add({
      targets: shockwave,
      scale: { from: 0.2, to: 1.5 },
      alpha: { from: 0.8, to: 0 },
      duration: duration * 0.7,
      ease: "Power2Out",
    });

    // Create brighter inner shockwave
    const innerShockwave = scene.add.circle(targetX, targetY, effectSize * 0.25, 0xffffff, 0.85);
    innerShockwave.setDepth(7);
    gameObjects.push(innerShockwave);

    // Animate the inner shockwave
    scene.tweens.add({
      targets: innerShockwave,
      scale: { from: 0.1, to: 1.2 },
      alpha: { from: 0.9, to: 0 },
      duration: duration * 0.6,
      ease: "Power1Out",
    });

    // Create "impact crater" centered at target spot
    const crater = scene.add.circle(targetX, targetY, effectSize * 0.3, 0x000000, 0.4);
    crater.setDepth(5);
    gameObjects.push(crater);

    // Animate the crater (stays briefly then fades)
    scene.tweens.add({
      targets: crater,
      scale: { from: 0.1, to: 0.8 },
      alpha: { from: 0.5, to: 0 },
      duration: duration,
      ease: "Expo.Out",
    });

    // Create "impact lines" radiating outward
    const impactLines = scene.add.graphics();
    impactLines.lineStyle(3, bashColor, 0.8);
    impactLines.setDepth(6);
    gameObjects.push(impactLines);

    const lineCount = 10; // More lines for a more dramatic effect
    for (let i = 0; i < lineCount; i++) {
      // More controlled spread
      const lineAngle = facingAngle + (Math.random() * 2 - 1) * Math.PI * 0.35;
      const lineLength = effectSize * (0.5 + Math.random() * 0.5);

      impactLines.beginPath();
      impactLines.moveTo(targetX, targetY);
      impactLines.lineTo(
        targetX + Math.cos(lineAngle) * lineLength,
        targetY + Math.sin(lineAngle) * lineLength
      );
      impactLines.strokePath();
    }

    // Fade out the impact lines
    scene.tweens.add({
      targets: impactLines,
      alpha: { from: 1, to: 0 },
      duration: duration * 0.8,
      ease: "Power1Out",
    });

    // Create dust particles spreading from impact point
    for (let i = 0; i < 15; i++) {
      const dustAngle = facingAngle + (Math.random() * 2 - 1) * Math.PI * 0.6; // Limited to front arc
      const dustDistance = (10 + Math.random() * effectSize) * 0.8;
      const dustSize = 2 + Math.random() * 4;

      // Create dust with varied gray/brown colors
      const dustColors = [0xcccccc, 0xbbaa99, 0xaa9988, 0x998877];
      const dustColor = dustColors[Math.floor(Math.random() * dustColors.length)];

      const dust = scene.add.circle(
        targetX,
        targetY,
        dustSize,
        dustColor,
        0.4 + Math.random() * 0.3
      );
      dust.setDepth(5);
      gameObjects.push(dust);

      // Animate dust particles flying outward and fading
      scene.tweens.add({
        targets: dust,
        x: targetX + Math.cos(dustAngle) * dustDistance,
        y: targetY + Math.sin(dustAngle) * dustDistance,
        alpha: 0,
        scale: { from: 1, to: 0.5 },
        duration: duration * (0.3 + Math.random() * 0.5),
        ease: "Power2Out",
      });
    }

    // Create a small flash at impact point
    const flash = scene.add.circle(targetX, targetY, effectSize * 0.35, 0xffffff, 0.9);
    flash.setDepth(8);
    gameObjects.push(flash);

    // Quickly fade out the flash
    scene.tweens.add({
      targets: flash,
      scale: { from: 0.1, to: 1.0 },
      alpha: { from: 0.9, to: 0 },
      duration: duration * 0.3,
      ease: "Power1Out",
    });
  }

  /**
   * Creates highlights for each affected tile
   */
  protected createTileHighlights(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    // Get config values or use defaults
    const tileColor = config.tileColor || 0xeeddaa; // Match bash color

    positions.forEach((pos) => {
      // Create ground crack effect beneath tile highlight
      const cracks = scene.add.graphics();
      cracks.lineStyle(2, 0x333333, 0.7);
      cracks.setDepth(4);
      gameObjects.push(cracks);

      // Draw 4-5 random cracks
      const crackCount = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < crackCount; i++) {
        const startAngle = Math.random() * Math.PI * 2;
        const crackLength = (this.TILE_SIZE / 2) * (0.4 + Math.random() * 0.5);

        // Create a jagged line with 2-3 segments
        let currentX = pos.x;
        let currentY = pos.y;
        let currentAngle = startAngle;

        cracks.beginPath();
        cracks.moveTo(currentX, currentY);

        const segments = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < segments; j++) {
          // Slightly adjust angle for each segment
          currentAngle += Math.random() * 0.8 - 0.4;
          const segmentLength = crackLength / segments;

          currentX += Math.cos(currentAngle) * segmentLength;
          currentY += Math.sin(currentAngle) * segmentLength;

          cracks.lineTo(currentX, currentY);
        }

        cracks.strokePath();
      }

      // Fade out cracks
      scene.tweens.add({
        targets: cracks,
        alpha: { from: 0.7, to: 0 },
        duration: duration,
        ease: "Power1In",
      });

      // Create tile highlight with pulsing effect
      const highlight = scene.add.rectangle(
        pos.x,
        pos.y,
        this.TILE_SIZE - 4,
        this.TILE_SIZE - 4,
        tileColor,
        0.4
      );
      highlight.setDepth(5);
      gameObjects.push(highlight);

      // Animate the highlight with a pulse before fading
      scene.tweens.add({
        targets: highlight,
        alpha: { from: 0.5, to: 0.7 },
        scale: { from: 0.9, to: 1.0 },
        duration: duration * 0.3,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          scene.tweens.add({
            targets: highlight,
            alpha: 0,
            scale: 1.1,
            duration: duration * 0.4,
            ease: "Power1In",
          });
        },
      });

      // Create small shockwave coming from center of tile
      const tileShockwave = scene.add.circle(pos.x, pos.y, this.TILE_SIZE * 0.3, tileColor, 0.3);
      tileShockwave.setDepth(5);
      gameObjects.push(tileShockwave);

      scene.tweens.add({
        targets: tileShockwave,
        scale: { from: 0.3, to: 1.0 },
        alpha: { from: 0.4, to: 0 },
        duration: duration * 0.6,
        ease: "Sine.Out",
      });
    });
  }
}
