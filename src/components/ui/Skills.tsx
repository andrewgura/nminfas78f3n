import React, { useState, useRef, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";
import { SkillData } from "@/types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";

interface SkillRowProps {
  skillId: string;
  skillName: string;
  skill: SkillData;
  bonusLevel?: number;
  onMouseEnter: (skillId: string) => void;
  onMouseLeave: () => void;
}

const SkillRow: React.FC<SkillRowProps> = ({
  skillId,
  skillName,
  skill,
  bonusLevel = 0,
  onMouseEnter,
  onMouseLeave,
}) => {
  const progressPercent = Math.min(100, Math.floor((skill.experience / skill.maxExperience) * 100));

  // Handle level-up flash animation
  const [isFlashing, setIsFlashing] = useState(false);

  useEventBus("playerCharacter.skill.updated", (data) => {
    if (data.skillId === skillId && data.leveledUp) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 1000);
    }
  });

  return (
    <div
      id={`skill-row-${skillId}`}
      className={`skill-row ${isFlashing ? "level-up-flash" : ""}`}
      onMouseEnter={() => onMouseEnter(skillId)}
      onMouseLeave={onMouseLeave}
    >
      <div className="skill-header">
        <div className="skill-name">{skillName}</div>
        <div id={`${skillId}-level`} className="skill-level">
          {skill.level}
          {bonusLevel > 0 && <span className="bonus-value"> +{bonusLevel}</span>}
        </div>
      </div>
      <div className="skill-progress-container">
        <div
          id={`${skillId}-fill`}
          className={`skill-progress-fill skill-${skillId}`}
          style={{ width: `${progressPercent}%` }}
        />
        <div id={`${skillId}-progress`} className="skill-progress-text">
          {progressPercent}/100
        </div>
      </div>
    </div>
  );
};

interface SecondaryStatRowProps {
  statId: string;
  statName: string;
  baseValue: number;
  bonusValue?: number;
  icon: string;
}

const SecondaryStatRow: React.FC<SecondaryStatRowProps> = ({
  statId,
  statName,
  baseValue,
  bonusValue = 0,
  icon,
}) => {
  const totalValue = baseValue + bonusValue;

  return (
    <div id={`stat-row-${statId}`} className="secondary-stat-row">
      <div className="secondary-stat-icon">{icon}</div>
      <div className="secondary-stat-name">{statName}</div>
      <div id={`${statId}-value`} className="secondary-stat-value">
        {totalValue}
        {bonusValue > 0 && <span className="bonus-value"> +{bonusValue}</span>}
      </div>
    </div>
  );
};

interface TooltipProps {
  skillId: string;
  skill: SkillData;
  visible: boolean;
  position: { x: number; y: number };
}

const SkillTooltip: React.FC<TooltipProps> = ({ skillId, skill, visible, position }) => {
  if (!visible) return null;

  const progressPercent = Math.floor((skill.experience / skill.maxExperience) * 100);
  const remainingPercent = 100 - progressPercent;
  const bonusDescription = getSkillBonusDescription(skillId, skill.level * 5);

  return (
    <div
      className="skill-tooltip"
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        display: visible ? "block" : "none",
      }}
    >
      <div className="tooltip-title">{getSkillName(skillId)}</div>
      <div className="tooltip-info">
        Level: <span className="tooltip-level">{skill.level}</span>
      </div>
      <div className="tooltip-info">
        Experience: <span className="tooltip-exp">{progressPercent}%/100%</span>
      </div>
      <div className="tooltip-info">
        Remaining: <span className="tooltip-remaining">{remainingPercent}%</span>
      </div>
      <div className="tooltip-divider"></div>
      <div className="tooltip-bonus">{bonusDescription}</div>
    </div>
  );
};

// Helper functions
const getSkillName = (skillId: string): string => {
  const skillNames: Record<string, string> = {
    playerLevel: "Level",
    meleeWeapons: "Melee Weapons",
    archery: "Archery",
    magic: "Magic",
    shield: "Shield",
  };
  return skillNames[skillId] || skillId;
};

const getSkillBonusDescription = (skillId: string, bonus: number): string => {
  const descriptions: Record<string, string> = {
    playerLevel: `+${bonus}% to all attributes`,
    meleeWeapons: `+${bonus}% damage with melee weapons`,
    archery: `+${bonus}% damage with bows and crossbows`,
    magic: `+${bonus}% magic damage and effect`,
    shield: `+${bonus}% damage reduction from all sources`,
  };
  return descriptions[skillId] || `+${bonus}% effectiveness`;
};

// Calculate skill bonuses from equipment
const calculateSkillBonus = (skillId: string, equipment: any): number => {
  let totalBonus = 0;

  // Skip if no equipment
  if (!equipment) return 0;

  // Check each equipped item for bonuses
  Object.values(equipment).forEach((itemInstance: any) => {
    if (!itemInstance) return;

    // Check instance bonusStats directly
    if (itemInstance.bonusStats && itemInstance.bonusStats[skillId]) {
      totalBonus += itemInstance.bonusStats[skillId];
    }

    // Mapped stat bonuses from instance
    const mappedStat = getMappedStatForSkill(skillId);
    if (mappedStat && itemInstance.bonusStats && itemInstance.bonusStats[mappedStat]) {
      totalBonus += itemInstance.bonusStats[mappedStat];
    }
  });

  return totalBonus;
};

const getMappedStatForSkill = (skillId: string): string | null => {
  const skillToStatMap: Record<string, string> = {
    meleeWeapons: "melee",
    archery: "archery",
    magic: "magic",
    shield: "armor",
    playerLevel: "health",
  };
  return skillToStatMap[skillId] || null;
};

// Helper function to calculate total equipment bonus for a secondary stat
const calculateSecondaryStatBonus = (statId: string, equipment: any): number => {
  let totalBonus = 0;

  // Skip if no equipment
  if (!equipment) return 0;

  // Check each equipped item for bonuses
  Object.values(equipment).forEach((itemInstance: any) => {
    if (!itemInstance || !itemInstance.bonusStats) return;

    if (itemInstance.bonusStats[statId]) {
      totalBonus += itemInstance.bonusStats[statId];
    }
  });

  return totalBonus;
};

// Helper function to calculate total power from equipment
function calculateTotalPower(equipment: any): number {
  let totalPower = 0;

  Object.values(equipment).forEach((itemInstance: any) => {
    if (!itemInstance) return;

    // Get combined stats from the item instance
    const itemData = ItemInstanceManager.getCombinedStats(itemInstance);
    if (itemData?.power) {
      totalPower += itemData.power;
    }
  });

  return totalPower;
}

// Helper function to calculate total armor from equipment
function calculateTotalArmor(equipment: any): number {
  let totalArmor = 0;

  Object.values(equipment).forEach((itemInstance: any) => {
    if (!itemInstance) return;

    // Get combined stats from the item instance
    const itemData = ItemInstanceManager.getCombinedStats(itemInstance);
    if (itemData?.armor) {
      totalArmor += itemData.armor;
    }
  });

  return totalArmor;
}

enum SkillTab {
  MAIN = "main",
  SECONDARY = "secondary",
}

const SkillsWindow: React.FC = () => {
  const { playerCharacter } = useGameStore();
  const [activeTab, setActiveTab] = useState<SkillTab>(SkillTab.MAIN);
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean;
    skillId: string;
    position: { x: number; y: number };
  }>({
    visible: false,
    skillId: "",
    position: { x: 0, y: 0 },
  });

  // Visibility state
  const [visible, setVisible] = useState(false);

  // Dragging state
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - 250,
    y: window.innerHeight / 2 - 300,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const emitEvent = useEmitEvent();

  // Listen for toggle events
  useEventBus("skills.toggle", (data: { visible: boolean }) => {
    setVisible(data.visible);

    // Emit visibility changed event
    emitEvent("skills.visibility.changed", data.visible);
  });

  // Listen to K key to toggle window
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if an input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === "k") {
        setVisible(!visible);
        emitEvent("skills.visibility.changed", !visible);
        emitEvent("ui.message.show", !visible ? "Skills window opened" : "Skills window closed");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [visible, emitEvent]);

  const handleSkillMouseEnter = (skillId: string) => {
    // Get position of skill row
    const element = document.getElementById(`skill-row-${skillId}`);
    if (!element) return;

    const rect = element.getBoundingClientRect();

    // Show tooltip
    setTooltipState({
      visible: true,
      skillId,
      position: {
        x: rect.right + 10,
        y: rect.top,
      },
    });
  };

  const handleSkillMouseLeave = () => {
    setTooltipState((prev) => ({ ...prev, visible: false }));
  };

  // Calculate bonuses
  const getSkillBonus = (skillId: string): number => {
    return calculateSkillBonus(skillId, playerCharacter.equipment);
  };

  // Base values for secondary stats
  const baseSecondaryStats: Record<string, number> = {
    health: playerCharacter.maxHealth,
    mana: 100, // Default value, adjust as needed
    power: 0,
    armor: 0,
    moveSpeed: 1, // Default value
    healthRegen: 1, // Default value
    manaRegen: 1, // Default value
    capacity: playerCharacter.maxCapacity,
    attackSpeed: 2,
  };

  // Icons for secondary stats
  const secondaryStatIcons: Record<string, string> = {
    health: "❤️",
    mana: "💙",
    power: "⚔️",
    armor: "🛡️",
    moveSpeed: "👟",
    healthRegen: "💗",
    manaRegen: "💦",
    capacity: "📦",
    attackSpeed: "💨",
  };

  // Friendly names for secondary stats
  const secondaryStatNames: Record<string, string> = {
    health: "Health",
    mana: "Mana",
    power: "Power",
    armor: "Armor",
    strength: "Strength",
    moveSpeed: "Move Speed",
    healthRegen: "Health Regen",
    manaRegen: "Mana Regen",
    capacity: "Capacity",
    regen: "Regeneration",
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      windowRef.current &&
      e.target === windowRef.current.querySelector(".skills-window-header")
    ) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle close button
  const handleClose = () => {
    setVisible(false);
    emitEvent("skills.visibility.changed", false);
    emitEvent("ui.message.show", "Skills window closed");
  };

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="skills-window-overlay"
      onClick={(e) => {
        // Close if clicking outside the window
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={windowRef}
        className="skills-window"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? "grabbing" : "default",
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="skills-window-header">
          <h3>Character Skills</h3>
          <button className="skills-window-close" onClick={handleClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="skills-tabs">
          <div
            className={`skills-tab ${activeTab === SkillTab.MAIN ? "active" : ""}`}
            onClick={() => setActiveTab(SkillTab.MAIN)}
          >
            Main Skills
          </div>
          <div
            className={`skills-tab ${activeTab === SkillTab.SECONDARY ? "active" : ""}`}
            onClick={() => setActiveTab(SkillTab.SECONDARY)}
          >
            Secondary Stats
          </div>
        </div>

        <div className="skills-window-content">
          {/* Main Skills Tab */}
          {activeTab === SkillTab.MAIN && (
            <div className="skills-wrapper">
              {/* Player Level */}
              <SkillRow
                skillId="playerLevel"
                skillName="Level"
                skill={playerCharacter.skills.playerLevel}
                bonusLevel={getSkillBonus("playerLevel")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              {/* Combat Skills */}
              <SkillRow
                skillId="meleeWeapons"
                skillName="Melee Weapons"
                skill={playerCharacter.skills.meleeWeapons}
                bonusLevel={getSkillBonus("meleeWeapons")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="archery"
                skillName="Archery"
                skill={playerCharacter.skills.archery}
                bonusLevel={getSkillBonus("archery")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="magic"
                skillName="Magic"
                skill={playerCharacter.skills.magic}
                bonusLevel={getSkillBonus("magic")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="shield"
                skillName="Shield"
                skill={
                  playerCharacter.skills.shield || { level: 1, experience: 0, maxExperience: 20 }
                }
                bonusLevel={getSkillBonus("shield")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              {/* Equipment Stats */}
              <div className="equipment-stats">
                <div className="stats-divider"></div>

                <div className="stat-row">
                  <div className="stat-name">Power</div>
                  <div id="total-power" className="stat-value">
                    {calculateTotalPower(playerCharacter.equipment)}
                  </div>
                </div>

                <div className="stat-row">
                  <div className="stat-name">Armor</div>
                  <div id="total-armor" className="stat-value">
                    {calculateTotalArmor(playerCharacter.equipment)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Stats Tab */}
          {activeTab === SkillTab.SECONDARY && (
            <div className="secondary-stats-wrapper">
              <div className="secondary-stats-grid">
                {/* Character Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Character Stats</h4>

                  <SecondaryStatRow
                    statId="health"
                    statName="Health"
                    baseValue={baseSecondaryStats.health}
                    bonusValue={calculateSecondaryStatBonus("health", playerCharacter.equipment)}
                    icon={secondaryStatIcons.health}
                  />

                  <SecondaryStatRow
                    statId="mana"
                    statName="Mana"
                    baseValue={baseSecondaryStats.mana}
                    bonusValue={calculateSecondaryStatBonus("mana", playerCharacter.equipment)}
                    icon={secondaryStatIcons.mana}
                  />

                  <SecondaryStatRow
                    statId="capacity"
                    statName="Capacity"
                    baseValue={baseSecondaryStats.capacity}
                    bonusValue={calculateSecondaryStatBonus("capacity", playerCharacter.equipment)}
                    icon={secondaryStatIcons.capacity}
                  />
                </div>

                {/* Combat Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Combat Stats</h4>

                  <SecondaryStatRow
                    statId="power"
                    statName="Power"
                    baseValue={baseSecondaryStats.power}
                    bonusValue={calculateTotalPower(playerCharacter.equipment)}
                    icon={secondaryStatIcons.power}
                  />

                  <SecondaryStatRow
                    statId="armor"
                    statName="Armor"
                    baseValue={baseSecondaryStats.armor}
                    bonusValue={calculateTotalArmor(playerCharacter.equipment)}
                    icon={secondaryStatIcons.armor}
                  />

                  <SecondaryStatRow
                    statId="attackSpeed"
                    statName="Attack Speed"
                    baseValue={baseSecondaryStats.attackSpeed}
                    bonusValue={calculateTotalArmor(playerCharacter.equipment)}
                    icon={secondaryStatIcons.attackSpeed}
                  />
                </div>
              </div>

              <div className="secondary-stats-grid">
                {/* Regeneration Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Regeneration</h4>

                  <SecondaryStatRow
                    statId="healthRegen"
                    statName="Health Regen"
                    baseValue={baseSecondaryStats.healthRegen}
                    bonusValue={calculateSecondaryStatBonus(
                      "healthRegen",
                      playerCharacter.equipment
                    )}
                    icon={secondaryStatIcons.healthRegen}
                  />

                  <SecondaryStatRow
                    statId="manaRegen"
                    statName="Mana Regen"
                    baseValue={baseSecondaryStats.manaRegen}
                    bonusValue={calculateSecondaryStatBonus("manaRegen", playerCharacter.equipment)}
                    icon={secondaryStatIcons.manaRegen}
                  />
                </div>

                {/* Movement Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Misc</h4>

                  <SecondaryStatRow
                    statId="moveSpeed"
                    statName="Move Speed"
                    baseValue={baseSecondaryStats.moveSpeed}
                    bonusValue={calculateSecondaryStatBonus("moveSpeed", playerCharacter.equipment)}
                    icon={secondaryStatIcons.moveSpeed}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tooltip */}
        {tooltipState.visible && playerCharacter.skills[tooltipState.skillId] && (
          <SkillTooltip
            skillId={tooltipState.skillId}
            skill={playerCharacter.skills[tooltipState.skillId]}
            visible={tooltipState.visible}
            position={tooltipState.position}
          />
        )}
      </div>
    </div>
  );
};

export default SkillsWindow;
