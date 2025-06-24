import Phaser from "phaser";
import { ItemDictionary } from "@/services/ItemDictionaryService";
import { MonsterAnimationSystem } from "@/services/MonsterAnimationSystems";
import { MonsterDictionary } from "@/services/MonsterDictionaryService";
import { eventBus } from "@/utils/EventBus";

export class BootScene extends Phaser.Scene {
  loadErrors: Error[];
  progressBar: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: "boot" });
    // Track loading errors
    this.loadErrors = [];
  }

  preload(): void {
    try {
      this.createLoadingUI();

      // Load assets
      this.loadMapAssets();
      this.loadCharacterAssets();
      this.loadMonsterAssets();
      this.loadItemAssets();
      this.loadAbilityAssets();
    } catch (error) {
      console.error("Error in BootScene.preload:", error);
      this.loadErrors.push(error as Error);
    }
  }

  loadMapAssets(): void {
    try {
      // Load the tilemap JSON
      this.load.tilemapTiledJSON("game-map", "assets/maps/devground.json");
      this.load.tilemapTiledJSON("noob-cave-map", "assets/maps/noob-cave.json");

      // Individual tile files - use unique keys for each one
      const tileFiles = [
        "37.bmp",
        "38.bmp",
        "39.bmp",
        "40.bmp",
        "41.bmp",
        "42.bmp",
        "43.bmp",
        "44.bmp",
        "45.bmp",
        "46.bmp",
        "47.bmp",
        "48.bmp",
        "49.bmp",
        "50.bmp",
        "51.bmp",
        "52.bmp",
        "201.bmp",
        "205.bmp",
        "206.bmp",
        "207.bmp",
        "208.bmp",
        "209.bmp",
        "210.bmp",
        "211.bmp",
        "224.bmp",
        "225.bmp",
        "227.bmp",
        "228.bmp",
        "229.bmp",
        "230.bmp",
        "231.bmp",
        "232.bmp",
        "233.bmp",
        "234.bmp",
        "235.bmp",
        "236.bmp",
        "237.bmp",
        "238.bmp",
        "239.bmp",
        "240.bmp",
        "241.bmp",
        "242.bmp",
        "243.bmp",
        "244.bmp",
        "245.bmp",
        "316.bmp",
        "317.bmp",
        "318.bmp",
        "319.bmp",
        "320.bmp",
        "321.bmp",
        "322.bmp",
        "323.bmp",
        "1539.bmp",
        "10321.bmp",
      ];

      [
        "129.bmp",
        "128.bmp",
        "125.bmp",
        "122.bmp",
        "123.bmp",
        "124.bmp",
        "126.bmp",
        "127.bmp",
        "135.bmp",
        "130.bmp",
        "133.bmp",
        "131.bmp",
        "132.bmp",
        "134.bmp",
      ].forEach((file) => {
        const key = `../tileset/castle/${file}`;
        this.load.image(key, `assets/tileset/castle/${file}`);
      });

      ["1122.bmp"].forEach((file) => {
        const key = `../tileset/collision/${file}`;
        this.load.image(key, `assets/tileset/collision/${file}`);
      });

      [
        "1414.bmp",
        "63.bmp",
        "315.bmp",
        "123.bmp",
        "124.bmp",
        "125.bmp",
        "122.bmp",
        "3420.bmp",
        "3419.bmp",
        "911.bmp",
        "1122.bmp",
      ].forEach((file) => {
        const key = `../tileset/noob-cave/${file}`;
        this.load.image(key, `assets/tileset/noob-cave/${file}`);
      });

      this.load.image("chest-closed", "assets/sprites/chest-closed.png");
      this.load.image("chest-open", "assets/sprites/chest-open.png");

      // Load each tile with its own key based on the filename
      tileFiles.forEach((file) => {
        const key = `../tileset/starter-town/${file}`;
        this.load.image(key, `assets/tileset/starter-town/${file}`);
      });
    } catch (error) {
      console.error("Error in BootScene.loadMapAssets:", error);
      this.loadErrors.push(error as Error);
    }
  }

  loadCharacterAssets(): void {
    try {
      this.load.spritesheet("playerCharacter", "assets/sprites/player.png", {
        frameWidth: 32,
        frameHeight: 32,
        margin: 30,
      });
    } catch (error) {
      console.error("Error in BootScene.loadCharacterAssets:", error);
      this.loadErrors.push(error as Error);
    }
  }

  loadMonsterAssets(): void {
    try {
      // Get all monster IDs from MonsterDictionary
      const monsterData = MonsterDictionary.getAllMonsters();
      const monsterIds = Object.keys(monsterData);

      // Load each monster sprite as a spritesheet
      monsterIds.forEach((monsterId) => {
        const monster = monsterData[monsterId];
        if (monster && monster.sprite) {
          const margin = monster.spriteSize === 32 ? 0 : 30;
          this.load.spritesheet(monsterId, monster.sprite, {
            frameWidth: 32,
            frameHeight: 32,
            margin,
          });
        }
      });
    } catch (error) {
      console.error("Error in BootScene.loadMonsterAssets:", error);
      this.loadErrors.push(error as Error);
    }
  }

  loadAbilityAssets(): void {
    try {
      // Load ability icons
      this.load.image("fireball", "assets/abilities/fireball.png");
      this.load.image("sword-slash", "assets/abilities/sword-slash.png");
      this.load.image("whirlwind", "assets/abilities/whirlwind.png");
      this.load.image("ice_nova", "assets/abilities/ice_nova.png");
      this.load.image("energy-wave", "assets/abilities/energy-wave.png");
      this.load.image("power-shot", "assets/abilities/power-shot.png");
      this.load.image("focus", "assets/abilities/focus.png");
      this.load.image("rain-of-arrows", "assets/abilities/rain-of-arrows.png");
      this.load.image("bone-spike", "assets/abilities/bone-spike.png");
    } catch (error) {
      console.error("Error in BootScene.loadAbilityAssets:", error);
      this.loadErrors.push(error as Error);
    }
  }

  createLoadingUI(): void {
    try {
      // Create loading text
      const loadingText = this.add
        .text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 50, "Loading...", {
          font: "20px Arial",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      // Create loading bar
      const progressBar = this.add.graphics();
      const progressBox = this.add.graphics();
      progressBox.fillStyle(0x222222, 0.8);
      progressBox.fillRect(
        this.cameras.main.width / 2 - 160,
        this.cameras.main.height / 2,
        320,
        50
      );
      // Loading progress events
      this.load.on("progress", this.updateLoadingBar, this);
      this.load.on("complete", () => {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
      });

      // Store reference to progress bar for the updateLoadingBar method
      this.progressBar = progressBar;
    } catch (error) {
      console.error("Error in BootScene.createLoadingUI:", error);
      this.loadErrors.push(error as Error);
    }
  }

  loadItemAssets(): void {
    try {
      const items = ItemDictionary.getAllItems();
      const itemIds = Object.keys(items);

      // Load each item's texture
      itemIds.forEach((itemId) => {
        const item = items[itemId];
        if (item && item.texture) {
          const folder = ItemDictionary.getItemFolder(item);
          this.load.image(item.texture, `assets/equipment/${folder}/${item.texture}.png`);
        }
      });

      // Add a fallback texture
      if (!this.textures.exists("item-placeholder")) {
        this.load.image("item-placeholder", "assets/equipment/melee-weapons/commoner-sword.png");
      }
    } catch (error) {
      console.error("Error in BootScene.loadItemAssets:", error);
      this.loadErrors.push(error as Error);
    }
  }

  updateLoadingBar(value: number): void {
    try {
      if (this.progressBar) {
        this.progressBar.clear();
        this.progressBar.fillStyle(0x2ecc71, 1);
        this.progressBar.fillRect(
          this.cameras.main.width / 2 - 150,
          this.cameras.main.height / 2 + 10,
          300 * value,
          30
        );
      }
    } catch (error) {
      console.error("Error in BootScene.updateLoadingBar:", error);
      this.loadErrors.push(error as Error);
    }
  }

  createPlayerCharacterAnimations(): void {
    try {
      // Idle animations
      this.anims.create({
        key: "idle-down",
        frames: [{ key: "playerCharacter", frame: 0 }],
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "idle-left",
        frames: [{ key: "playerCharacter", frame: 6 }],
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "idle-up",
        frames: [{ key: "playerCharacter", frame: 12 }],
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "idle-right",
        frames: [{ key: "playerCharacter", frame: 18 }],
        frameRate: 10,
        repeat: -1,
      });

      // Walking animations
      this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("playerCharacter", { frames: [2, 0, 4, 0] }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "walk-left",
        frames: this.anims.generateFrameNumbers("playerCharacter", { frames: [8, 6, 10, 6] }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("playerCharacter", { frames: [14, 12, 16, 12] }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("playerCharacter", { frames: [20, 18, 22, 18] }),
        frameRate: 10,
        repeat: -1,
      });
    } catch (error) {
      console.error("Error in BootScene.createPlayerCharacterAnimations:", error);
      this.loadErrors.push(error as Error);
    }
  }

  create(): void {
    try {
      // Report any loading errors to the UI
      if (this.loadErrors.length > 0) {
        eventBus.emit(
          "ui.message.show",
          "Warning: Some assets failed to load. Check console for details."
        );
      }

      // Create player character animations
      this.createPlayerCharacterAnimations();

      // Create monster animations
      MonsterAnimationSystem.createAnimations(this);

      // Emit assets loaded event
      eventBus.emit("assets.loaded", null);

      // Start the game scene
      this.scene.start("game");
    } catch (error) {
      console.error("Error in BootScene.create:", error);
      this.loadErrors.push(error as Error);
    }
  }
}
