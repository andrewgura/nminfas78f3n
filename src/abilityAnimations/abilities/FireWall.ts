import { BaseStrategy } from "../BaseStrategy";
import { Ability } from "@/types";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Monster } from "@/entities/Monster";

export class FireWallAbility extends BaseStrategy {
  // Default FireWall pattern (perpendicular to facing direction)
  private getDefaultPattern(direction: string): number[][] {
    switch (direction) {
      case "up":
      case "down":
        // Horizontal wall when facing up/down
        return [
          [-2, 0],
          [-1, 0],
          [0, 0],
          [1, 0],
          [2, 0],
        ];
      case "left":
      case "right":
        // Vertical wall when facing left/right
        return [
          [0, -2],
          [0, -1],
          [0, 0],
          [0, 1],
          [0, 2],
        ];
      default:
        return [[0, 0]];
    }
  }

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
      const effectDuration = config.effectDuration || 5000; // Longer duration for wall
      const debug = config.debug || false;
      const damage = ability.damage || 15;

      // Get the direction the player is facing
      const facing = playerCharacter.facing || "down";
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Create the fire wall effect
      await this.createFireWallEffect(
        scene,
        playerCharacter,
        ability,
        gameObjects,
        activeAnimations
      );

      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in FireWallAbility.play:", error);
      return Promise.resolve();
    }
  }

  /**
   * Creates a fire wall in front of the player
   */
  protected async createFireWallEffect(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    gameObjects: Phaser.GameObjects.GameObject[],
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void> {
    try {
      const facingAngle = this.getFacingAngle(playerCharacter);
      const x = playerCharacter.x;
      const y = playerCharacter.y;
      const config = ability.animationConfig || {};
      const effectDuration = config.effectDuration || 5000; // Default 5 seconds
      const tileSize = this.TILE_SIZE;
      const damage = ability.damage || 8;

      // Calculate wall endpoints
      const perpAngle = facingAngle + Math.PI / 2; // Perpendicular to facing direction
      const wallLength = config.wallLength || 160;
      const wallWidth = config.wallWidth || 32;
      const wallHalfLength = wallLength / 2;

      // Calculate the offset in front of player
      const offsetDist = 40; // Offset in front of player
      const offsetX = Math.cos(facingAngle) * offsetDist;
      const offsetY = Math.sin(facingAngle) * offsetDist;

      // Wall center coordinates
      const wallCenterX = x + offsetX;
      const wallCenterY = y + offsetY;

      // Start and end points of the wall
      const startX = wallCenterX + Math.cos(perpAngle) * wallHalfLength;
      const startY = wallCenterY + Math.sin(perpAngle) * wallHalfLength;
      const endX = wallCenterX + Math.cos(perpAngle) * -wallHalfLength;
      const endY = wallCenterY + Math.sin(perpAngle) * -wallHalfLength;

      // Create affected tiles for visualization
      const affectedTiles = this.getFireWallTiles(
        wallCenterX,
        wallCenterY,
        perpAngle,
        wallLength,
        tileSize,
        offsetDist
      );

      // Track affected monsters to avoid duplicate hits in same damage tick
      const affectedMonsters = new Set<Monster>();

      // Create a wall graphic with fire colors
      const wall = scene.add.graphics();
      wall.lineStyle(wallWidth, 0xff3300, 0.5); // Red-orange for fire
      wall.lineBetween(startX, startY, endX, endY);
      wall.setDepth(5);
      gameObjects.push(wall);

      // Create visual effects for each affected tile
      affectedTiles.forEach((tile) => {
        // Create fire-colored tile highlight
        const highlight = scene.add.rectangle(tile.x, tile.y, tileSize, tileSize, 0xff7700, 0.3); // Orange for fire
        highlight.setDepth(5);
        gameObjects.push(highlight);

        // Animate pulse effect
        scene.tweens.add({
          targets: highlight,
          alpha: { from: 0.2, to: 0.4 },
          yoyo: true,
          repeat: -1,
          duration: 500,
          ease: "Sine.InOut",
        });

        // Add some simple particles with motion
        for (let i = 0; i < 2; i++) {
          const particleX = tile.x + (Math.random() * tileSize - tileSize / 2);
          const particleY = tile.y + (Math.random() * tileSize - tileSize / 2);

          // Use fire color palette for particles
          const fireColors = [0xffff00, 0xff7700, 0xff3300, 0xff0000]; // Yellow to red
          const particleColor = fireColors[Math.floor(Math.random() * fireColors.length)];
          const particle = scene.add.circle(
            particleX,
            particleY,
            2 + Math.random() * 3,
            particleColor,
            0.7
          );
          particle.setDepth(6);
          gameObjects.push(particle);

          // Animate the particle rising up
          scene.tweens.add({
            targets: particle,
            y: particleY - 20 - Math.random() * 10,
            alpha: 0,
            duration: 1000 + Math.random() * 1000,
            onComplete: () => {
              // Create a new particle in the same tile
              if (particle.active) {
                particle.y = tile.y + (Math.random() * tileSize - tileSize / 2);
                particle.x = tile.x + (Math.random() * tileSize - tileSize / 2);
                particle.alpha = 0.7;

                // Start the animation again if wall is still active
                if (wall.active) {
                  scene.tweens.add({
                    targets: particle,
                    y: particleY - 20 - Math.random() * 10,
                    alpha: 0,
                    duration: 1000 + Math.random() * 1000,
                    onComplete: function () {
                      particle.destroy();
                    },
                  });
                }
              }
            },
          });
        }
      });

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Apply damage to monsters every half second
      const damageInterval = 500; // 500ms = 0.5 seconds
      let elapsedTime = 0;

      // Create the damage timer
      const damageTimer = scene.time.addEvent({
        delay: damageInterval,
        callback: () => {
          elapsedTime += damageInterval;

          // Apply damage to monsters in the wall
          this.applyFireWallDamage(
            scene,
            wallCenterX,
            wallCenterY,
            perpAngle,
            wallLength,
            wallWidth,
            damage,
            affectedMonsters
          );

          // Reset affected monsters set after each damage application
          affectedMonsters.clear();

          // Stop the timer once we've reached the effect duration
          if (elapsedTime >= effectDuration) {
            damageTimer.remove();
          }
        },
        callbackScope: this,
        loop: true,
      });

      // Setup fire wall fade out
      scene.tweens.add({
        targets: [wall, ...gameObjects.filter((obj) => obj !== wall)],
        alpha: 0,
        delay: effectDuration - 1000, // Start fading 1 second before end
        duration: 1000,
        ease: "Sine.easeIn",
        onComplete: function () {
          // Clean up all game objects
          gameObjects.forEach((obj) => {
            if (obj.active) {
              obj.destroy();
            }
          });

          // Cancel timer if it's still running
          damageTimer.remove();

          // Remove from active animations
          activeAnimations.delete(ability.id);
        },
      });

      // Return a promise that resolves when the animation completes
      return Promise.resolve();
    } catch (error) {
      console.error("Error in FireWallAbility.createFireWallEffect:", error);
      return Promise.resolve();
    }
  }

  /**
   * Gets the tiles affected by the fire wall
   */
  protected getFireWallTiles(
    centerX: number,
    centerY: number,
    perpAngle: number,
    wallLength: number,
    tileSize: number,
    offsetDist: number
  ): Array<{ x: number; y: number }> {
    try {
      const tiles: Array<{ x: number; y: number }> = [];

      // Calculate number of tiles in the wall
      const tilesInWall = Math.ceil(wallLength / tileSize);

      // Create affected tiles in a line perpendicular to facing direction
      for (let i = -Math.floor(tilesInWall / 2); i <= Math.floor(tilesInWall / 2); i++) {
        // Calculate tile position along the perpendicular line
        const tileX = centerX + Math.cos(perpAngle) * (i * tileSize);
        const tileY = centerY + Math.sin(perpAngle) * (i * tileSize);

        // Snap to grid
        const gridX = Math.floor(tileX / tileSize) * tileSize + tileSize / 2;
        const gridY = Math.floor(tileY / tileSize) * tileSize + tileSize / 2;

        tiles.push({ x: gridX, y: gridY });
      }

      return tiles;
    } catch (error) {
      console.error("Error in FireWallAbility.getFireWallTiles:", error);
      return [];
    }
  }

  /**
   * Applies damage to monsters that are in the fire wall
   */
  protected applyFireWallDamage(
    scene: Phaser.Scene,
    wallCenterX: number,
    wallCenterY: number,
    perpAngle: number,
    wallLength: number,
    wallWidth: number,
    damage: number,
    affectedMonsters: Set<Monster>
  ): void {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return;

      const monsters = gameScene.monsters.getChildren() as Monster[];

      monsters.forEach((monster) => {
        // Skip if monster already affected in this damage tick
        if (affectedMonsters.has(monster) || !monster.active) return;

        // Calculate distance from monster to line segment (wall)
        const distToWall = this.distanceToLine(
          monster.x,
          monster.y,
          wallCenterX + (Math.cos(perpAngle) * wallLength) / 2,
          wallCenterY + (Math.sin(perpAngle) * wallLength) / 2,
          wallCenterX + (Math.cos(perpAngle) * -wallLength) / 2,
          wallCenterY + (Math.sin(perpAngle) * -wallLength) / 2
        );

        // Check if monster is within wall width
        if (distToWall <= wallWidth / 2 + 20) {
          // Adding 20px tolerance for better hit detection
          console.log(`Fire Wall hit monster at distance ${distToWall.toFixed(1)} from wall`);

          // Apply damage
          if (monster.takeDamage) {
            monster.takeDamage(damage);
            // Use BaseStrategy's implementation
            this.showDamageEffect(scene, monster, damage);

            // Mark as affected for this damage tick
            affectedMonsters.add(monster);
          }
        }
      });
    } catch (error) {
      console.error("Error in FireWallAbility.applyFireWallDamage:", error);
    }
  }

  /**
   * Creates fire particles for the wall
   */
  protected createFireParticles(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count: number,
    duration: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    const colors = [0xffff00, 0xff7700, 0xff3300, 0xff0000]; // Yellow to red

    for (let i = 0; i < count; i++) {
      // Random position within the tile
      const offsetX = (Math.random() - 0.5) * this.TILE_SIZE * 0.7;
      const offsetY = (Math.random() - 0.5) * this.TILE_SIZE * 0.7;

      // Random color from the fire palette
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Create the particle
      const size = 3 + Math.random() * 5;
      const particle = scene.add.circle(x + offsetX, y + offsetY, size, color, 0.8);
      particle.setDepth(6);
      gameObjects.push(particle);

      // Random animation duration (shorter than the wall duration)
      const particleDuration = 500 + Math.random() * 800;

      // Animate the particle rising and fading
      scene.tweens.add({
        targets: particle,
        y: particle.y - (10 + Math.random() * 15), // Rise upward
        scale: { from: 1, to: 0.2 + Math.random() * 0.5 },
        alpha: { from: 0.8, to: 0 },
        duration: particleDuration,
        ease: "Sine.Out",
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }
}
