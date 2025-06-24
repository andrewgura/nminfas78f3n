import { AnimationStrategy } from "../AnimationStrategy";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { BaseStrategy } from "../BaseStrategy";

export class ProjectileStrategy extends BaseStrategy implements AnimationStrategy {
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

      // Get the direction the player is facing
      const facingAngle = this.getFacingAngle(playerCharacter);

      // Create the projectile
      const projectile = this.createProjectile(scene, x, y, facingAngle, config);
      gameObjects.push(projectile);

      // Create trail effect
      const trail: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < 5; i++) {
        const trailSegment = scene.add.rectangle(x, y, 16, 16, 0xffffff, 0.5 - i * 0.1);
        trailSegment.setDepth(5);
        trail.push(trailSegment);
        gameObjects.push(trailSegment);
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Launch the projectile
      return this.launchProjectile(
        scene,
        projectile,
        trail,
        facingAngle,
        playerCharacter,
        ability,
        activeAnimations
      );
    } catch (error) {
      console.error("Error in ProjectileStrategy.play:", error);
      return Promise.resolve();
    }
  }

  private createProjectile(
    scene: Phaser.Scene,
    x: number,
    y: number,
    facingAngle: number,
    config: Record<string, any>
  ): Phaser.GameObjects.Rectangle {
    try {
      // Create a simple rectangle projectile
      const projectile = scene.add.rectangle(x, y, 24, 24, 0xffffff, 0.8);
      projectile.setDepth(6);

      // Add physics body to the projectile
      scene.physics.add.existing(projectile);
      const body = projectile.body as Phaser.Physics.Arcade.Body;

      // Set projectile properties
      body.setSize(16, 16);
      body.setCollideWorldBounds(true);
      body.onWorldBounds = true;

      // Set velocity based on facing angle
      const speed = config.projectileSpeed || 300;
      const velocityX = Math.cos(facingAngle) * speed;
      const velocityY = Math.sin(facingAngle) * speed;
      body.setVelocity(velocityX, velocityY);

      return projectile;
    } catch (error) {
      console.error("Error in ProjectileStrategy.createProjectile:", error);
      // Return a fallback projectile
      return scene.add.rectangle(x, y, 24, 24, 0xffffff, 0.8);
    }
  }

  private async launchProjectile(
    scene: Phaser.Scene,
    projectile: Phaser.GameObjects.Rectangle,
    trail: Phaser.GameObjects.Rectangle[],
    facingAngle: number,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void> {
    try {
      const gameScene = scene as any;
      const projectileBody = projectile.body as Phaser.Physics.Arcade.Body;
      const range = ability.range || 150;
      const config = ability.animationConfig || {};
      const damage = ability.damage || 10;

      // Track if the projectile has hit something
      let hasHit = false;

      // Set up collision with the collision layer
      if (gameScene.collisionLayer) {
        scene.physics.add.collider(projectile, gameScene.collisionLayer, () => {
          this.handleProjectileHit(
            scene,
            projectile,
            trail,
            facingAngle,
            ability,
            activeAnimations,
            null
          );
          hasHit = true;
        });
      }

      // Set up collision with monsters
      if (gameScene.monsters) {
        scene.physics.add.overlap(projectile, gameScene.monsters, (proj, monster) => {
          if (!hasHit) {
            this.handleProjectileHit(
              scene,
              projectile,
              trail,
              facingAngle,
              ability,
              activeAnimations,
              monster as Monster
            );
            hasHit = true;

            // Apply damage to the monster
            if ((monster as Monster).takeDamage) {
              console.log(`Projectile hit monster, applying ${damage} damage`);
              (monster as Monster).takeDamage(damage);
              this.showDamageEffect(scene, monster, damage);
            }
          }
        });
      }

      // Listen for projectile hitting world bounds
      scene.physics.world.on("worldbounds", (body: Phaser.Physics.Arcade.Body) => {
        if (body === projectileBody && !hasHit) {
          this.handleProjectileHit(
            scene,
            projectile,
            trail,
            facingAngle,
            ability,
            activeAnimations,
            null
          );
          hasHit = true;
        }
      });

      // Update trail segments in a loop
      const trailUpdateEvent = scene.time.addEvent({
        delay: 20,
        callback: () => {
          this.updateTrail(trail, projectile);
        },
        callbackScope: this,
        loop: true,
      });

      // Maximum distance check
      const startX = playerCharacter.x;
      const startY = playerCharacter.y;

      return new Promise((resolve) => {
        // Create a timer to check distance and cleanup
        const distanceCheckEvent = scene.time.addEvent({
          delay: 50,
          callback: () => {
            // Check if projectile has gone beyond maximum range
            const distance = Phaser.Math.Distance.Between(
              startX,
              startY,
              projectile.x,
              projectile.y
            );

            if (distance > range || hasHit || !projectile.active) {
              if (distance > range && !hasHit) {
                // Reached maximum range without hitting anything
                this.handleProjectileHit(
                  scene,
                  projectile,
                  trail,
                  facingAngle,
                  ability,
                  activeAnimations,
                  null
                );
              }

              // Clean up events
              distanceCheckEvent.remove();
              trailUpdateEvent.remove();
              scene.physics.world.off("worldbounds");

              // Resolve the promise
              resolve();
            }
          },
          callbackScope: this,
          loop: true,
        });
      });
    } catch (error) {
      console.error("Error in ProjectileStrategy.launchProjectile:", error);
      return Promise.resolve();
    }
  }

  private updateTrail(
    trail: Phaser.GameObjects.Rectangle[],
    projectile: Phaser.GameObjects.Rectangle
  ): void {
    try {
      // Move each trail segment to the position of the segment in front of it
      for (let i = trail.length - 1; i > 0; i--) {
        trail[i].x = trail[i - 1].x;
        trail[i].y = trail[i - 1].y;
      }

      // Set the first trail segment to the projectile's position
      if (trail.length > 0) {
        trail[0].x = projectile.x;
        trail[0].y = projectile.y;
      }
    } catch (error) {
      console.error("Error in ProjectileStrategy.updateTrail:", error);
    }
  }

  private handleProjectileHit(
    scene: Phaser.Scene,
    projectile: Phaser.GameObjects.Rectangle,
    trail: Phaser.GameObjects.Rectangle[],
    facingAngle: number,
    ability: Ability,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>,
    hitMonster: Monster | null
  ): void {
    try {
      const config = ability.animationConfig || {};
      const explosionGameObjects: Phaser.GameObjects.GameObject[] = [];

      // Stop the projectile
      const body = projectile.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      // Create explosion effect if there's an explosion radius
      if (config.explosionRadius && config.explosionRadius > 0) {
        const explosionRadius = config.explosionRadius || 64;
        const explosionParticles = 12;

        // Create multiple particles around the hit point to form an explosion
        for (let i = 0; i < explosionParticles; i++) {
          const angle = (i / explosionParticles) * Math.PI * 2;
          const distance = Math.random() * explosionRadius * 0.8;

          const particleX = projectile.x + Math.cos(angle) * distance;
          const particleY = projectile.y + Math.sin(angle) * distance;

          // Create explosion particle
          const particle = scene.add.rectangle(
            particleX,
            particleY,
            8 + Math.random() * 16,
            8 + Math.random() * 16,
            0xffffff,
            0.8
          );
          particle.setDepth(5);
          explosionGameObjects.push(particle);

          // Animate the explosion particle
          scene.tweens.add({
            targets: particle,
            alpha: 0,
            scale: { from: 1, to: 0.5 },
            duration: 500,
            ease: "Power2",
            onComplete: () => {
              particle.destroy();
            },
          });
        }

        // Add a central flash
        const flash = scene.add.rectangle(
          projectile.x,
          projectile.y,
          explosionRadius * 0.8,
          explosionRadius * 0.8,
          0xffffff,
          0.7
        );
        flash.setDepth(4);
        explosionGameObjects.push(flash);

        // Animate the central flash
        scene.tweens.add({
          targets: flash,
          alpha: 0,
          scale: { from: 1, to: 1.5 },
          duration: 400,
          ease: "Power2",
          onComplete: () => {
            flash.destroy();
          },
        });

        // Apply area damage to monsters in radius (if not already hit directly)
        if (hitMonster) {
          // Apply damage to other monsters in range
          this.applyAreaDamage(
            scene,
            projectile.x,
            projectile.y,
            explosionRadius,
            ability.damage,
            hitMonster
          );
        } else {
          // Apply damage to all monsters in range
          this.applyAreaDamage(scene, projectile.x, projectile.y, explosionRadius, ability.damage);
        }
      }

      // Fade out the projectile and trail
      scene.tweens.add({
        targets: [projectile, ...trail],
        alpha: 0,
        duration: 300,
        ease: "Power2",
        onComplete: () => {
          projectile.destroy();
          trail.forEach((segment) => segment.destroy());
        },
      });

      // Add explosion objects to active animations
      const currentObjects = activeAnimations.get(ability.id) || [];
      activeAnimations.set(ability.id, [...currentObjects, ...explosionGameObjects]);
    } catch (error) {
      console.error("Error in ProjectileStrategy.handleProjectileHit:", error);
    }
  }

  private applyAreaDamage(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    damage: number,
    excludeMonster: Monster | null = null
  ): void {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return;

      const monsters = gameScene.monsters.getChildren() as Monster[];

      monsters.forEach((monster) => {
        // Skip the directly hit monster to avoid double damage
        if (excludeMonster && monster === excludeMonster) return;

        // Calculate distance from explosion center to monster
        const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);

        if (distance <= radius) {
          // Apply damage with falloff based on distance
          const falloff = 1 - distance / radius;
          const actualDamage = Math.max(1, Math.floor(damage * falloff));

          if (monster.takeDamage) {
            monster.takeDamage(actualDamage);
            this.showDamageEffect(scene, monster, actualDamage);
          }
        }
      });
    } catch (error) {
      console.error("Error in ProjectileStrategy.applyAreaDamage:", error);
    }
  }

  getObjectTypesForPositioning(): string[] {
    return []; // No objects need repositioning
  }
}
