import { BaseStrategy } from "../BaseStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Monster } from "@/entities/Monster";
import { Ability } from "@/types";

export class FireballAbility extends BaseStrategy {
  // Default explosion pattern (relative to impact point)
  private readonly EXPLOSION_PATTERN: number[][] = [
    [0, 0], // Center tile
    [-1, -1],
    [0, -1],
    [1, -1], // Top row
    [-1, 0],
    [1, 0], // Middle row
    [-1, 1],
    [0, 1],
    [1, 1], // Bottom row
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
      const effectDuration = config.effectDuration || 1000;
      const debug = config.debug || false;
      const damage = ability.damage || 15;

      // Get the direction the player is facing
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Get custom explosion pattern or use default
      let explosionPattern = this.EXPLOSION_PATTERN;
      if (config.explosionPattern && Array.isArray(config.explosionPattern)) {
        explosionPattern = config.explosionPattern;
      }

      // Create the projectile
      const projectile = this.createProjectile(scene, x, y, facingAngle, config);
      gameObjects.push(projectile);

      // Create trail effect
      const trailParticles: Phaser.GameObjects.GameObject[] = [];
      for (let i = 0; i < 5; i++) {
        const trail = scene.add.circle(x, y, 5 - i, 0xff7700, 0.7 - i * 0.1);
        trail.setDepth(5);
        trailParticles.push(trail);
        gameObjects.push(trail);
      }

      // Launch the projectile and wait for impact
      const impactInfo = await this.launchProjectile(
        scene,
        projectile,
        trailParticles,
        facingAngle,
        playerCharacter,
        ability
      );

      if (impactInfo) {
        // Create explosion effect and apply damage at impact point
        const { impactX, impactY, hitMonster } = impactInfo;
        await this.createExplosion(
          scene,
          impactX,
          impactY,
          explosionPattern,
          damage,
          config,
          hitMonster,
          gameObjects
        );
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Set up cleanup timer using BaseStrategy method
      this.setupCleanupTimer(scene, effectDuration, gameObjects, activeAnimations, ability.id);

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in FireballAbility.play:", error);
      return Promise.resolve();
    }
  }

  protected createProjectile(
    scene: Phaser.Scene,
    x: number,
    y: number,
    facingAngle: number,
    config: Record<string, any>
  ): Phaser.GameObjects.GameObject {
    try {
      // Get config values or use defaults
      const projectileColors = config.projectileColors || [0xff4500, 0xff7700, 0xffaa00, 0xffdd00];
      const projectileSize = config.projectileSize || 12;

      // Create a container for the projectile parts
      const container = scene.add.container(x, y);
      container.setDepth(6);

      // Create the main fireball (inner core + outer glow)
      const innerCore = scene.add.circle(0, 0, projectileSize * 0.6, projectileColors[3], 0.9);
      const outerFlame = scene.add.circle(0, 0, projectileSize, projectileColors[1], 0.7);
      const outerGlow = scene.add.circle(0, 0, projectileSize * 1.5, projectileColors[0], 0.3);

      // Add pulsing animation to the core
      scene.tweens.add({
        targets: innerCore,
        scale: { from: 0.9, to: 1.1 },
        yoyo: true,
        repeat: -1,
        duration: 200,
        ease: "Sine.easeInOut",
      });

      // Add flame particles that emit continuously
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = projectileSize * 0.7;
        const flameParticle = scene.add.circle(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          projectileSize * 0.4,
          projectileColors[Math.floor(Math.random() * 2)],
          0.7
        );

        container.add(flameParticle);

        // Animate each flame particle
        scene.tweens.add({
          targets: flameParticle,
          x: flameParticle.x + Math.random() * 10 - 5,
          y: flameParticle.y + Math.random() * 10 - 5,
          alpha: 0,
          scale: { from: 1, to: 0.5 },
          duration: 300 + Math.random() * 200,
          onComplete: () => {
            // Reset the particle position and restart the animation
            flameParticle.setPosition(
              Math.cos(Math.random() * Math.PI * 2) * distance,
              Math.sin(Math.random() * Math.PI * 2) * distance
            );
            flameParticle.setAlpha(0.7);
            flameParticle.setScale(1);

            scene.tweens.add({
              targets: flameParticle,
              x: flameParticle.x + Math.random() * 10 - 5,
              y: flameParticle.y + Math.random() * 10 - 5,
              alpha: 0,
              scale: { from: 1, to: 0.5 },
              duration: 300 + Math.random() * 200,
              onComplete: function () {
                flameParticle.destroy();
              },
            });
          },
        });
      }

      // Add all parts to the container
      container.add([outerGlow, outerFlame, innerCore]);

      // Add physics body to the projectile
      scene.physics.add.existing(container);
      const body = (container as any).body as Phaser.Physics.Arcade.Body;

      // Set projectile properties
      body.setSize(projectileSize * 2, projectileSize * 2);
      body.setCollideWorldBounds(true);
      body.onWorldBounds = true;

      // Set velocity based on facing angle
      const speed = config.projectileSpeed || 300;
      const velocityX = Math.cos(facingAngle) * speed;
      const velocityY = Math.sin(facingAngle) * speed;
      body.setVelocity(velocityX, velocityY);

      return container;
    } catch (error) {
      console.error("Error creating projectile:", error);
      // Create a fallback projectile
      const fallback = scene.add.circle(x, y, 8, 0xff0000, 0.8);
      scene.physics.add.existing(fallback);
      const body = (fallback as any).body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.onWorldBounds = true;
      return fallback;
    }
  }

  protected async launchProjectile(
    scene: Phaser.Scene,
    projectile: Phaser.GameObjects.GameObject,
    trailParticles: Phaser.GameObjects.GameObject[],
    facingAngle: number,
    playerCharacter: PlayerCharacter,
    ability: Ability
  ): Promise<{ impactX: number; impactY: number; hitMonster: Monster | null } | null> {
    try {
      return new Promise((resolve) => {
        const gameScene = scene as any;
        const projectileBody = (projectile as any).body as Phaser.Physics.Arcade.Body;
        const range = ability.range || 250;
        const config = ability.animationConfig || {};

        // Cast projectile to include x, y properties
        const proj = projectile as Phaser.GameObjects.GameObject & { x: number; y: number };

        // Track if the projectile has hit something
        let hasHit = false;
        let impactX = 0;
        let impactY = 0;
        let hitMonster: Monster | null = null;

        // Set up collision with the collision layer
        if (gameScene.collisionLayer) {
          scene.physics.add.collider(projectile, gameScene.collisionLayer, () => {
            if (!hasHit) {
              hasHit = true;
              impactX = proj.x;
              impactY = proj.y;

              // Stop the projectile
              projectileBody.setVelocity(0, 0);

              // Resolve with impact position
              resolve({ impactX, impactY, hitMonster: null });
            }
          });
        }

        // Set up collision with monsters
        if (gameScene.monsters) {
          scene.physics.add.overlap(projectile, gameScene.monsters, (proj, monster) => {
            if (!hasHit) {
              hasHit = true;
              // Use proj from the callback, which is the projectile
              impactX = (proj as Phaser.GameObjects.GameObject & { x: number; y: number }).x;
              impactY = (proj as Phaser.GameObjects.GameObject & { x: number; y: number }).y;
              hitMonster = monster as Monster;

              // Stop the projectile
              projectileBody.setVelocity(0, 0);

              // Resolve with impact position and hit monster
              resolve({ impactX, impactY, hitMonster });
            }
          });
        }

        // Listen for projectile hitting world bounds
        scene.physics.world.on("worldbounds", (body: Phaser.Physics.Arcade.Body) => {
          if (body === projectileBody && !hasHit) {
            hasHit = true;
            impactX = proj.x;
            impactY = proj.y;

            // Resolve with impact position
            resolve({ impactX, impactY, hitMonster: null });
          }
        });

        // Update trail particles in a loop
        const updateTrailEvent = scene.time.addEvent({
          delay: 20,
          callback: () => {
            this.updateTrail(trailParticles, projectile);
          },
          callbackScope: this,
          loop: true,
        });

        // Maximum distance check
        const startX = playerCharacter.x;
        const startY = playerCharacter.y;

        // Create a timer to check distance and cleanup
        const distanceCheckEvent = scene.time.addEvent({
          delay: 50,
          callback: () => {
            if (hasHit) return;

            // Check if projectile has gone beyond maximum range
            const distance = Phaser.Math.Distance.Between(startX, startY, proj.x, proj.y);

            if (distance > range || !projectile.active) {
              if (distance > range && !hasHit) {
                // Reached maximum range without hitting anything
                hasHit = true;
                impactX = proj.x;
                impactY = proj.y;

                // Stop the projectile
                projectileBody.setVelocity(0, 0);

                // Resolve with impact position
                resolve({ impactX, impactY, hitMonster: null });
              }

              // Stop checking
              distanceCheckEvent.remove();
              updateTrailEvent.remove();
            }
          },
          callbackScope: this,
          loop: true,
        });

        // Timeout in case nothing is hit (safety)
        scene.time.delayedCall(5000, () => {
          if (!hasHit) {
            distanceCheckEvent.remove();
            updateTrailEvent.remove();
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error("Error in launchProjectile:", error);
      return Promise.resolve(null);
    }
  }

  protected updateTrail(
    trailParticles: Phaser.GameObjects.GameObject[],
    projectile: Phaser.GameObjects.GameObject
  ): void {
    try {
      // Type assertion to access x and y properties
      const proj = projectile as Phaser.GameObjects.GameObject & { x: number; y: number };

      // Move each trail segment to the position of the segment in front of it
      for (let i = trailParticles.length - 1; i > 0; i--) {
        // Type assertion for each particle
        const current = trailParticles[i] as Phaser.GameObjects.GameObject & {
          x: number;
          y: number;
        };
        const prev = trailParticles[i - 1] as Phaser.GameObjects.GameObject & {
          x: number;
          y: number;
        };

        current.x = prev.x;
        current.y = prev.y;
      }

      // Set the first trail segment to the projectile's position
      if (trailParticles.length > 0) {
        const first = trailParticles[0] as Phaser.GameObjects.GameObject & { x: number; y: number };
        first.x = proj.x;
        first.y = proj.y;
      }
    } catch (error) {
      console.error("Error in updateTrail:", error);
    }
  }

  protected async createExplosion(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pattern: number[][],
    damage: number,
    config: Record<string, any>,
    hitMonster: Monster | null,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): Promise<void> {
    try {
      // Calculate the tile coordinates of the impact point
      const impactTileX = Math.floor(x / this.TILE_SIZE);
      const impactTileY = Math.floor(y / this.TILE_SIZE);

      // Convert the pattern to world positions
      const worldPositions = this.convertPatternToWorldPositions(pattern, impactTileX, impactTileY);

      // Add screen shake
      const camera = scene.cameras.main;
      camera.shake(150, 0.005);

      // Create a multi-layered explosion flash
      const flash1 = scene.add.circle(x, y, 25, 0xffffff, 1);
      const flash2 = scene.add.circle(x, y, 45, 0xffdd00, 0.8);
      const flash3 = scene.add.circle(x, y, 60, 0xff7700, 0.6);
      const flash4 = scene.add.circle(x, y, 75, 0xff4500, 0.4);

      flash1.setDepth(8);
      flash2.setDepth(7);
      flash3.setDepth(6);
      flash4.setDepth(5);

      gameObjects.push(flash1, flash2, flash3, flash4);

      // Animate the flashes with slightly different timing
      scene.tweens.add({
        targets: flash1,
        scale: { from: 0.1, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: 200,
        ease: "Sine.Out",
      });

      scene.tweens.add({
        targets: flash2,
        scale: { from: 0.1, to: 1.7 },
        alpha: { from: 0.8, to: 0 },
        duration: 250,
        ease: "Sine.Out",
      });

      scene.tweens.add({
        targets: flash3,
        scale: { from: 0.1, to: 1.9 },
        alpha: { from: 0.6, to: 0 },
        duration: 300,
        ease: "Sine.Out",
      });

      scene.tweens.add({
        targets: flash4,
        scale: { from: 0.1, to: 2.2 },
        alpha: { from: 0.4, to: 0 },
        duration: 350,
        ease: "Sine.Out",
      });

      // Create expanding shockwave
      const shockwave = scene.add.circle(x, y, 10, 0xffaa00, 0);
      shockwave.setStrokeStyle(3, 0xffdd00, 1);
      shockwave.setDepth(5);
      gameObjects.push(shockwave);

      scene.tweens.add({
        targets: shockwave,
        scale: { from: 0.1, to: 7 },
        alpha: { from: 1, to: 0 },
        duration: 500,
        ease: "Cubic.Out",
      });

      // Create more dynamic fire particles for each affected tile
      worldPositions.forEach((pos) => {
        // Create a pulsing tile effect
        const tileEffect = scene.add.rectangle(
          pos.x,
          pos.y,
          this.TILE_SIZE - 2,
          this.TILE_SIZE - 2,
          0xff3300,
          0.3
        );
        tileEffect.setDepth(4);
        gameObjects.push(tileEffect);

        scene.tweens.add({
          targets: tileEffect,
          alpha: { from: 0.3, to: 0.1 },
          yoyo: true,
          repeat: 3,
          duration: 150,
          onComplete: () => {
            scene.tweens.add({
              targets: tileEffect,
              alpha: 0,
              duration: 200,
            });
          },
        });

        // Create multiple fire column effects for each tile
        for (let i = 0; i < 3; i++) {
          this.createFireColumn(scene, pos.x, pos.y, gameObjects);
        }
      });

      // Apply damage to monsters in the affected tiles
      const hitCount = this.applyDamageToMonstersInTiles(
        scene,
        worldPositions,
        damage,
        config.debug || false
      );

      // Return a promise that resolves after a short delay
      return new Promise((resolve) => {
        scene.time.delayedCall(100, resolve);
      });
    } catch (error) {
      console.error("Error creating explosion:", error);
      return Promise.resolve();
    }
  }

  protected createFireColumn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Random position within tile
      const offsetX = (Math.random() - 0.5) * this.TILE_SIZE * 0.8;
      const offsetY = (Math.random() - 0.5) * this.TILE_SIZE * 0.8;

      // Create fire column base
      const baseX = x + offsetX;
      const baseY = y + offsetY;

      // Fire colors from bottom (hottest) to top
      const fireColors = [0xffffff, 0xffffaa, 0xffdd00, 0xffaa00, 0xff7700, 0xff4500, 0xff0000];

      // Create multiple flame particles in a column
      for (let i = 0; i < 6; i++) {
        const yOffset = -i * 6;
        const size = 6 - i * 0.7;
        const color = fireColors[Math.min(i, fireColors.length - 1)];
        const alpha = i === 0 ? 0.9 : 0.8 - i * 0.1;

        const flame = scene.add.circle(baseX, baseY + yOffset, size, color, alpha);
        flame.setDepth(6);
        gameObjects.push(flame);

        // Randomize the exact position slightly
        const flickerX = baseX + Math.random() * 6 - 3;

        // Animate each flame particle rising and fading
        scene.tweens.add({
          targets: flame,
          y: baseY + yOffset - (15 + Math.random() * 15), // Rise effect
          x: flickerX, // Subtle x movement for flickering effect
          alpha: 0,
          scale: { from: 1, to: 0.5 },
          duration: 700 + Math.random() * 300,
          ease: "Sine.Out",
        });
      }

      // Add ember particles
      for (let i = 0; i < 3; i++) {
        const ember = scene.add.circle(baseX, baseY, 2, 0xffdd00, 0.8);
        ember.setDepth(7);
        gameObjects.push(ember);

        // Random ember movement
        const angle = -Math.PI / 2 + (Math.random() - 0.5);
        const distance = 20 + Math.random() * 30;

        scene.tweens.add({
          targets: ember,
          x: baseX + Math.cos(angle) * distance * 0.3,
          y: baseY + Math.sin(angle) * distance,
          alpha: 0,
          scale: { from: 1, to: 0.5 },
          duration: 500 + Math.random() * 300,
          ease: "Quad.Out",
        });
      }
    } catch (error) {
      console.error("Error creating fire column:", error);
    }
  }
}
