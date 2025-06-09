import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class EnergyWaveAbility extends BaseStrategy {
  // Default Energy Wave pattern (for facing up)
  private readonly DEFAULT_PATTERN: number[][] = [
    [0, -1], // One tile directly above player
    [-1, -2],
    [0, -2],
    [1, -2], // Three tiles in row 2
    [-1, -3],
    [0, -3],
    [1, -3], // Three tiles in row 3
    [-2, -4],
    [-1, -4],
    [0, -4],
    [1, -4],
    [2, -4], // Five tiles in row 4
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
      const damage = ability.damage || 14;

      // Get the direction the player is facing
      const facing = playerCharacter.facing;
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Get custom pattern from ability config or use default
      let pattern = this.DEFAULT_PATTERN;
      if (config.pattern && Array.isArray(config.pattern)) {
        pattern = config.pattern;
      }

      // Rotate pattern based on facing direction using the fixed rotation method
      const rotatedPattern = this.rotatePatternFixed(pattern, facing);

      if (debug) {
        console.log(`Energy Wave cast - Player facing: ${facing}`);
      }

      // Calculate the player's tile position (center of the tile)
      const playerTileX = Math.floor(x / this.TILE_SIZE);
      const playerTileY = Math.floor(y / this.TILE_SIZE);

      if (debug) {
        console.log(`Player at tile: (${playerTileX}, ${playerTileY})`);
      }

      // Convert the pattern to world positions
      const worldPositions = this.convertPatternToWorldPositions(
        rotatedPattern,
        playerTileX,
        playerTileY
      );

      // Create visual effects for each affected tile
      const visualEffects = this.createVisualEffects(scene, worldPositions, effectDuration, config);
      gameObjects.push(...visualEffects);

      // Create debug visualization if requested
      if (debug) {
        const debugGraphics = this.createDebugVisualization(scene, worldPositions);
        gameObjects.push(debugGraphics);
      }

      // Apply damage to monsters in affected tiles with a slight delay for visual effect
      scene.time.delayedCall(50, () => {
        const hitCount = this.applyDamageToMonstersInTiles(scene, worldPositions, damage, debug);

        if (debug) {
          console.log(`Energy Wave hit ${hitCount} monsters using tile pattern`);
        }
      });

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
      console.error("Error in EnergyWaveAbility.play:", error);
      return Promise.resolve();
    }
  }

  /**
   * Fixed rotation method that correctly orients the pattern
   * based on the player's facing direction
   */
  private rotatePatternFixed(pattern: number[][], facing: string): number[][] {
    // If facing up, no rotation needed (base pattern)
    if (facing === "up") return pattern;

    return pattern.map(([x, y]) => {
      // Apply rotation based on facing direction
      switch (facing) {
        case "right":
          // 90° clockwise: (x,y) -> (y,-x)
          // But we reverse this for right: (x,y) -> (-y,x)
          return [-y, x];
        case "down":
          // 180°: (x,y) -> (-x,-y)
          return [-x, -y];
        case "left":
          // 90° counter-clockwise: (x,y) -> (-y,x)
          // But we reverse this for left: (x,y) -> (y,-x)
          return [y, -x];
        default:
          return [x, y];
      }
    });
  }

  private createVisualEffects(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    duration: number,
    config: Record<string, any>
  ): Phaser.GameObjects.GameObject[] {
    const gameObjects: Phaser.GameObjects.GameObject[] = [];

    // Get config values or use defaults
    const colors = config.particleColors || [
      0x00aaff, // bright blue
      0x0088ff, // medium blue
      0x0055dd, // darker blue
      0x66ccff, // light blue
    ];

    // Add a subtle screen shake
    scene.cameras.main.shake(200, 0.002);

    // Create a sequence effect - visualize tiles in sequence from player outward
    positions.forEach((pos, index) => {
      // Calculate delay based on distance from player (farther = more delay)
      const delay = index * 30; // 30ms delay per tile

      // Tile highlight with pulsing effect and gradient
      for (let i = 0; i < 3; i++) {
        const highlight = scene.add.rectangle(
          pos.x,
          pos.y,
          this.TILE_SIZE - 4 - i * 2,
          this.TILE_SIZE - 4 - i * 2,
          colors[i % colors.length],
          0.6 - i * 0.15
        );
        highlight.setDepth(5 - i);
        highlight.alpha = 0; // Start invisible
        gameObjects.push(highlight);

        // Animate the tile appearing then fading with slightly different timing
        scene.tweens.add({
          targets: highlight,
          alpha: { from: 0, to: 0.6 - i * 0.15 },
          scale: { from: 0.5, to: 1 },
          delay: delay + i * 30,
          duration: 150,
          onComplete: () => {
            scene.tweens.add({
              targets: highlight,
              alpha: 0,
              scale: 1.2,
              duration: duration - 150 - delay - i * 30,
              ease: "Power2",
            });
          },
        });
      }

      // Add energy particles for each tile - more varied and dynamic
      for (let i = 0; i < 6; i++) {
        const particleColor = colors[Math.floor(Math.random() * colors.length)];

        // Calculate particle position with more variation within the tile
        const offsetX = (Math.random() - 0.5) * this.TILE_SIZE * 0.8;
        const offsetY = (Math.random() - 0.5) * this.TILE_SIZE * 0.8;
        const particleX = pos.x + offsetX;
        const particleY = pos.y + offsetY;

        // Create particles with size variation
        const particleSize = 3 + Math.random() * 3;
        const particle = scene.add.circle(particleX, particleY, particleSize, particleColor, 0.8);
        particle.setDepth(6);
        particle.alpha = 0;
        gameObjects.push(particle);

        // Animate particle with delay and more dynamic movement
        scene.tweens.add({
          targets: particle,
          alpha: { from: 0, to: 0.8 },
          delay: delay + Math.random() * 100,
          duration: 100,
          onComplete: () => {
            // Calculate movement direction - particles move outward from center
            const distanceFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            let angle;

            if (distanceFromCenter > 0) {
              // Move along the current offset direction
              angle = Math.atan2(offsetY, offsetX);
            } else {
              // Random angle if at center
              angle = Math.random() * Math.PI * 2;
            }

            // Add some randomness to angle
            angle += (Math.random() - 0.5) * Math.PI * 0.3;

            // Calculate end position
            const distance = 15 + Math.random() * 15;
            const endX = particleX + Math.cos(angle) * distance;
            const endY = particleY + Math.sin(angle) * distance;

            // Animate with slightly curved paths
            const controlPointDistance = distance * 0.7;
            const controlPointAngle = angle + (Math.random() - 0.5) * Math.PI * 0.5;

            const controlX = particleX + Math.cos(controlPointAngle) * controlPointDistance;
            const controlY = particleY + Math.sin(controlPointAngle) * controlPointDistance;

            // Use multiple tweens to create curved motion
            scene.tweens.add({
              targets: particle,
              x: { from: particleX, to: controlX },
              y: { from: particleY, to: controlY },
              scale: { from: 1, to: 0.8 },
              ease: "Sine.Out",
              duration: 200,
              onComplete: () => {
                scene.tweens.add({
                  targets: particle,
                  x: { from: controlX, to: endX },
                  y: { from: controlY, to: endY },
                  alpha: 0,
                  scale: 0.4,
                  ease: "Cubic.In",
                  duration: 200,
                });
              },
            });
          },
        });
      }

      // Add energy arcs/lightning effects for further tiles (index > 2)
      if (index > 2) {
        scene.time.delayedCall(delay, () => {
          this.createEnergyArc(scene, pos.x, pos.y, colors[0], gameObjects);
        });
      }
    });

    return gameObjects;
  }

  // Add a new method for energy arcs
  private createEnergyArc(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    // Create a lightning/arc effect
    const arc = scene.add.graphics();
    arc.lineStyle(2, color, 0.8);
    arc.setDepth(7);
    gameObjects.push(arc);

    // Generate lightning points
    const points = [];
    const segments = 6 + Math.floor(Math.random() * 4);
    const maxOffset = 8;
    const arcLength = 20 + Math.random() * 15;
    const arcAngle = Math.random() * Math.PI * 2;

    // Starting point
    points.push({ x: 0, y: 0 });

    // Generate intermediary points with random offsets
    for (let i = 1; i < segments; i++) {
      const ratio = i / segments;
      const segmentLength = arcLength * ratio;
      const baseX = Math.cos(arcAngle) * segmentLength;
      const baseY = Math.sin(arcAngle) * segmentLength;

      // Add random offsets perpendicular to the main direction
      const perpAngle = arcAngle + Math.PI / 2;
      const offsetAmount = (Math.random() - 0.5) * 2 * maxOffset;
      const offsetX = Math.cos(perpAngle) * offsetAmount;
      const offsetY = Math.sin(perpAngle) * offsetAmount;

      points.push({
        x: baseX + offsetX,
        y: baseY + offsetY,
      });
    }

    // End point
    points.push({
      x: Math.cos(arcAngle) * arcLength,
      y: Math.sin(arcAngle) * arcLength,
    });

    // Draw the lightning effect
    arc.beginPath();
    arc.moveTo(x + points[0].x, y + points[0].y);

    for (let i = 1; i < points.length; i++) {
      arc.lineTo(x + points[i].x, y + points[i].y);
    }

    arc.strokePath();

    // Flash effect - quickly fade in and out several times
    let flashCount = 0;
    const maxFlashes = 3;

    const flashArc = () => {
      arc.alpha = 1;

      scene.tweens.add({
        targets: arc,
        alpha: 0.2,
        duration: 100,
        onComplete: () => {
          flashCount++;
          if (flashCount < maxFlashes) {
            flashArc();
          } else {
            // Final fadeout
            scene.tweens.add({
              targets: arc,
              alpha: 0,
              duration: 200,
            });
          }
        },
      });
    };

    flashArc();
  }
}
