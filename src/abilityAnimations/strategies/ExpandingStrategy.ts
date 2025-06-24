import { AnimationStrategy } from "../AnimationStrategy";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class ExpandingStrategy implements AnimationStrategy {
  // Keep track of monsters that have been hit by each ability ID
  private static hitMonstersByAbility: Map<string, Set<Monster>> = new Map();

  // Track monsters that are valid targets (in the forward direction)
  private static validMonstersByAbility: Map<string, Set<Monster>> = new Map();
  private static validMonstersKeysByAbility: Map<string, string> = new Map();

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
      // Clear any previous hit tracking for this ability
      ExpandingStrategy.hitMonstersByAbility.set(ability.id, new Set<Monster>());

      const gameObjects: Phaser.GameObjects.GameObject[] = [];
      const config = ability.animationConfig || {};
      const effectDuration = config.effectDuration || 1000;
      const tileSize = 32;

      // Get configuration with defaults
      const startRadius = config.startRadius || 20;
      const endRadius = config.endRadius || 128;
      const expansionTime = config.expansionTime || 500;
      const arcAngle = config.arcAngle || Math.PI * 2; // Full circle by default

      // Handle directional expanding effects
      let startAngle = 0;
      let endAngle = Math.PI * 2;
      let facingAngle = 0;

      if (arcAngle < Math.PI * 2) {
        // This is a partial arc like Energy Wave
        facingAngle = this.getFacingAngle(playerCharacter);
        const halfArc = arcAngle / 2;
        startAngle = facingAngle - halfArc;
        endAngle = facingAngle + halfArc;

        // Create a clear visual indicator of the facing direction
        const directionLine = scene.add.graphics();
        directionLine.lineStyle(4, 0x00ffff, 0.8);
        directionLine.beginPath();
        directionLine.moveTo(x, y);
        directionLine.lineTo(
          x + Math.cos(facingAngle) * (endRadius * 1.2),
          y + Math.sin(facingAngle) * (endRadius * 1.2)
        );
        directionLine.strokePath();
        gameObjects.push(directionLine);

        // Create a visual indicator of the entire affected area
        const affectedArea = scene.add.graphics();
        affectedArea.fillStyle(0xffffff, 0.1);
        affectedArea.lineStyle(2, 0xffffff, 0.2);
        affectedArea.beginPath();
        affectedArea.moveTo(x, y);
        affectedArea.lineTo(
          x + Math.cos(startAngle) * endRadius,
          y + Math.sin(startAngle) * endRadius
        );
        affectedArea.arc(x, y, endRadius, startAngle, endAngle);
        affectedArea.lineTo(x, y);
        affectedArea.closePath();
        affectedArea.fillPath();
        affectedArea.strokePath();
        affectedArea.setDepth(4);
        gameObjects.push(affectedArea);

        // Fade out the direction indicator after a short time
        scene.tweens.add({
          targets: [directionLine, affectedArea],
          alpha: 0,
          delay: 400,
          duration: 200,
        });

        // Pre-filter monsters to only those in the general direction of the cone
        this.prefilterMonstersInCone(scene, x, y, facingAngle, arcAngle, endRadius, ability.id);
      }

      // Create ring object that will expand
      const ring = scene.add.graphics();
      ring.setDepth(5);
      gameObjects.push(ring);

      // Precompute all hit checks to avoid issues with checking during animation
      const hitPositions: { radius: number; x: number; y: number }[] = [];
      const radiusSteps = 10; // Number of rings to check

      for (let step = 0; step < radiusSteps; step++) {
        const progress = step / (radiusSteps - 1);
        const radius = startRadius + (endRadius - startRadius) * progress;
        hitPositions.push({ radius, x, y });
      }

      // Create an update function for the ring
      const updateRing = (progress: number) => {
        // Clear previous drawing
        ring.clear();

        // Calculate current radius based on progress
        const currentRadius = startRadius + (endRadius - startRadius) * progress;

        // Draw the ring (for full circle or arc)
        ring.lineStyle(4, 0xffffff, 0.8 - progress * 0.3);

        if (arcAngle >= Math.PI * 2) {
          // Full circle
          ring.strokeCircle(x, y, currentRadius);
        } else {
          // Arc - draw wedge shape
          ring.beginPath();
          ring.moveTo(x, y);
          ring.arc(x, y, currentRadius, startAngle, endAngle, false);
          ring.lineTo(x, y);
          ring.strokePath();
        }
      };

      // Create particles inside the wave/circle
      for (let i = 0; i < 20; i++) {
        // For energy wave, constrain particles to the arc
        let angle;
        if (arcAngle < Math.PI * 2) {
          // For arc abilities like Energy Wave, constrain to the arc
          angle = Math.random() * arcAngle - arcAngle / 2 + facingAngle;
        } else {
          // For full circle abilities, use full 360 degrees
          angle = Math.random() * Math.PI * 2;
        }

        const distance = startRadius + Math.random() * (endRadius - startRadius);
        const particleX = x + Math.cos(angle) * distance;
        const particleY = y + Math.sin(angle) * distance;

        const particle = scene.add.rectangle(
          particleX,
          particleY,
          8 + Math.random() * 8,
          8 + Math.random() * 8,
          0xffffff,
          0.7
        );
        particle.setDepth(6);
        gameObjects.push(particle);

        // Animate the particle outward
        scene.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * endRadius * 1.2,
          y: y + Math.sin(angle) * endRadius * 1.2,
          alpha: 0,
          scale: 0.5,
          duration: effectDuration,
          ease: "Sine.easeOut",
        });
      }

      // For each step in animation, check for hits at specific points
      if (ability.id === "energyWave") {
        hitPositions.forEach((pos, index) => {
          // Delay each hit check to match animation timing
          const checkDelay = Math.floor((index / (hitPositions.length - 1)) * expansionTime);

          scene.time.delayedCall(checkDelay, () => {
            this.checkForHits(
              scene,
              playerCharacter,
              ability,
              pos.x,
              pos.y,
              pos.radius,
              facingAngle,
              arcAngle
            );
          });
        });
      }

      // Create the expansion animation
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: expansionTime,
        ease: "Sine.easeOut",
        onUpdate: (tween) => {
          updateRing(tween.getValue());
        },
        onComplete: () => {
          // Fade out the ring after full expansion
          scene.tweens.add({
            targets: ring,
            alpha: 0,
            duration: effectDuration - expansionTime,
            onComplete: () => {
              ring.destroy();
            },
          });
        },
      });

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Set up cleanup timer
      scene.time.delayedCall(effectDuration, () => {
        gameObjects.forEach((obj) => {
          if (obj.active) {
            obj.destroy();
          }
        });
        activeAnimations.delete(ability.id);

        // Clear hit monsters for this ability
        ExpandingStrategy.hitMonstersByAbility.delete(ability.id);

        // Clean up valid monsters tracking
        const validMonstersKey = ExpandingStrategy.validMonstersKeysByAbility.get(ability.id);
        if (validMonstersKey) {
          ExpandingStrategy.validMonstersByAbility.delete(validMonstersKey);
          ExpandingStrategy.validMonstersKeysByAbility.delete(ability.id);
        }
      });

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in ExpandingStrategy.play:", error);
      return Promise.resolve();
    }
  }

  // Use BaseStrategy's getFacingAngle method
  protected getFacingAngle(character: PlayerCharacter): number {
    try {
      const facing = character.facing || "down";
      switch (facing) {
        case "up":
          return -Math.PI / 2;
        case "right":
          return 0;
        case "down":
          return Math.PI / 2;
        case "left":
          return Math.PI;
        default:
          return 0;
      }
    } catch (error) {
      console.error("Error in getFacingAngle:", error);
      return 0;
    }
  }

  private prefilterMonstersInCone(
    scene: Phaser.Scene,
    x: number,
    y: number,
    facingAngle: number,
    arcAngle: number,
    maxRadius: number,
    abilityId: string
  ): void {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return;

      // Create a set to store monsters that are actually in the cone direction
      const monstersInCone = new Set<Monster>();
      const monsters = gameScene.monsters.getChildren() as Monster[];

      // Draw a debug visualization of the "safe zone" (where monsters won't be hit)
      if (true) {
        // For debugging
        const safeZone = scene.add.graphics();
        safeZone.fillStyle(0xff0000, 0.1);
        safeZone.lineStyle(1, 0xff0000, 0.2);
        safeZone.beginPath();
        safeZone.moveTo(x, y);

        // Draw the "back" half-circle (the area monsters CANNOT be hit in)
        const backStartAngle = facingAngle + Math.PI / 2;
        const backEndAngle = facingAngle - Math.PI / 2 + Math.PI * 2;
        safeZone.arc(x, y, maxRadius, backStartAngle, backEndAngle);
        safeZone.lineTo(x, y);
        safeZone.closePath();
        safeZone.fillPath();
        safeZone.strokePath();

        // Remove after a short time
        scene.time.delayedCall(500, () => {
          safeZone.clear();
          safeZone.destroy();
        });
      }

      monsters.forEach((monster) => {
        if (!monster.active) return;

        // Calculate basic info about the monster
        const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);
        const monsterAngle = Phaser.Math.Angle.Between(x, y, monster.x, monster.y);

        // Calculate the absolute angle difference from facing direction
        let angleDiff = Math.abs(monsterAngle - facingAngle);

        // Normalize the angle difference to [0, π]
        while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

        // Only consider monsters in the "forward" half-space of the player
        const isInForwardHalfSpace = angleDiff < Math.PI / 2;

        if (isInForwardHalfSpace && distance <= maxRadius * 1.1) {
          // Add to the valid monsters set
          monstersInCone.add(monster);

          // Mark the monster for debugging
          if (false) {
            // Disable this for production
            const marker = scene.add.circle(monster.x, monster.y, 16, 0x00ff00, 0.3);
            scene.time.delayedCall(500, () => marker.destroy());
          }
        } else {
          // Mark invalid monsters for debugging
          if (false) {
            // Disable this for production
            const marker = scene.add.circle(monster.x, monster.y, 16, 0xff0000, 0.3);
            scene.time.delayedCall(500, () => marker.destroy());

            // Add text to show why it's invalid
            const reason = isInForwardHalfSpace ? "Too far" : "Behind player";
            const text = scene.add.text(monster.x, monster.y - 20, reason, {
              fontSize: "10px",
              color: "#ff0000",
            });
            text.setOrigin(0.5);
            scene.time.delayedCall(500, () => text.destroy());
          }
        }
      });

      // Store this set in our hit tracking system
      // The key is constructed to be unique for each cast but shared among all hit checks
      const validMonstersKey = `${abilityId}-valid-monsters-${Date.now()}`;
      ExpandingStrategy.validMonstersByAbility.set(validMonstersKey, monstersInCone);

      // Store the key with the ability ID for lookup
      ExpandingStrategy.validMonstersKeysByAbility.set(abilityId, validMonstersKey);
    } catch (error) {
      console.error("Error in ExpandingStrategy.prefilterMonstersInCone:", error);
    }
  }

  /**
   * Checks for and handles hits on monsters within the wave area
   */
  private checkForHits(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    x: number,
    y: number,
    currentRadius: number,
    facingAngle: number,
    arcAngle: number
  ): void {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return;

      const damage = ability.damage || 10;
      const hitDistanceTolerance = ability.animationConfig?.hitDistanceTolerance || 8;

      // Get the set of already hit monsters for this ability
      const hitMonsters =
        ExpandingStrategy.hitMonstersByAbility.get(ability.id) || new Set<Monster>();

      // Get valid monsters that were pre-filtered (in the forward half-space)
      const validMonstersKey = ExpandingStrategy.validMonstersKeysByAbility.get(ability.id);
      const validMonsters = validMonstersKey
        ? ExpandingStrategy.validMonstersByAbility.get(validMonstersKey) || new Set<Monster>()
        : new Set<Monster>();

      // Draw the current radius for debugging
      const debugArc = scene.add.graphics();
      debugArc.lineStyle(2, 0xff00ff, 0.6);
      debugArc.beginPath();
      debugArc.arc(x, y, currentRadius, facingAngle - arcAngle / 2, facingAngle + arcAngle / 2);
      debugArc.strokePath();
      scene.time.delayedCall(200, () => {
        debugArc.clear();
        debugArc.destroy();
      });

      // Only consider monsters that passed the pre-filter (forward half-space)
      validMonsters.forEach((monster) => {
        // Skip already hit monsters or inactive monsters
        if (hitMonsters.has(monster) || !monster.active) return;

        // Calculate distance and angle to monster
        const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);
        const monsterAngle = Phaser.Math.Angle.Between(x, y, monster.x, monster.y);

        // Calculate the angle difference between facing direction and monster
        let angleDiff = monsterAngle - facingAngle;

        // Normalize angle difference to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Is monster near the current radius AND within the arc?
        const isInRadius = Math.abs(distance - currentRadius) < hitDistanceTolerance;
        const isInArc = Math.abs(angleDiff) <= arcAngle / 2;

        // Only hit if both conditions are true
        if (isInRadius && isInArc) {
          console.log(
            `Energy Wave hit monster at distance ${distance.toFixed(1)}, angle ${((angleDiff * 180) / Math.PI).toFixed(1)}°`
          );

          // Draw debug line to show hit
          const debugLine = scene.add.graphics();
          debugLine.lineStyle(2, 0x00ff00, 0.7);
          debugLine.beginPath();
          debugLine.moveTo(x, y);
          debugLine.lineTo(monster.x, monster.y);
          debugLine.strokePath();
          scene.time.delayedCall(400, () => {
            debugLine.clear();
            debugLine.destroy();
          });

          // Apply damage
          if (monster.takeDamage) {
            monster.takeDamage(damage);
            this.showDamageEffect(scene, monster, damage);
          }

          // Mark as hit to prevent multiple hits
          hitMonsters.add(monster);
          ExpandingStrategy.hitMonstersByAbility.set(ability.id, hitMonsters);
        }
      });
    } catch (error) {
      console.error("Error in ExpandingStrategy.checkForHits:", error);
    }
  }

  private showDamageEffect(scene: Phaser.Scene, target: any, damage: number): void {
    try {
      // Create damage text
      const text = scene.add.text(target.x, target.y - 20, `-${damage}`, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
      });

      text.setOrigin(0.5);
      text.setDepth(100);

      // Animate the text rising and fading
      scene.tweens.add({
        targets: text,
        y: target.y - 50,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          text.destroy();
        },
      });
    } catch (error) {
      console.error("Error in ExpandingStrategy.showDamageEffect:", error);
    }
  }

  getObjectTypesForPositioning(): string[] {
    return []; // Nothing needs repositioning with this implementation
  }
}
