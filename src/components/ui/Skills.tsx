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

enum SkillTab {
  MAIN = "main",
  SECONDARY = "secondary",
}

const SkillsWindow: React.FC = () => {
  const { playerCharacter, calculatedStats } = useGameStore();
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
    emitEvent("skills.visibility.changed", data.visible);
  });

  // Listen to K key to toggle window
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
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
    const element = document.getElementById(`skill-row-${skillId}`);
    if (!element) return;

    const rect = element.getBoundingClientRect();

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

  // Get skill bonuses from calculatedStats
  const getSkillBonus = (skillId: string): number => {
    return (
      calculatedStats.equipmentBonuses[skillId as keyof typeof calculatedStats.equipmentBonuses] ||
      0
    );
  };

  // Get skill data with fallback defaults
  const getSkillData = (skillId: string): SkillData => {
    return (
      playerCharacter.skills[skillId] || {
        level: 1,
        experience: 0,
        maxExperience: 15,
      }
    );
  };

  // Get total stat values from calculatedStats
  const getTotalStatValue = (statId: string): number => {
    switch (statId) {
      case "health":
        return calculatedStats.totalHealth;
      case "mana":
        return calculatedStats.totalMana;
      case "power":
        return calculatedStats.totalPower;
      case "armor":
        return calculatedStats.totalArmor;
      case "moveSpeed":
        return calculatedStats.totalMoveSpeed;
      case "healthRegen":
        return calculatedStats.totalHealthRegen;
      case "manaRegen":
        return calculatedStats.totalManaRegen;
      case "capacity":
        return calculatedStats.totalCapacity;
      case "attackSpeed":
        return calculatedStats.totalAttackSpeed;
      default:
        return 0;
    }
  };

  /**
   * Get attack speed display value (cooldown in seconds)
   */
  const getAttackSpeedDisplayValue = (): string => {
    const attackSpeed = calculatedStats.totalAttackSpeed;
    // Use the same formula as AutoAttackSystem: max(200, 2000 - ((attackSpeed - 1) * 50))
    const cooldownMs = Math.max(200, 2000 - (attackSpeed - 1) * 50);
    const cooldownSeconds = cooldownMs / 1000;

    // Format to 1 decimal place and add "/s" suffix
    return `${cooldownSeconds.toFixed(1)}/s`;
  };

  /**
   * Custom SecondaryStatRow for Attack Speed with cooldown display
   */
  const AttackSpeedStatRow: React.FC = () => {
    const displayValue = getAttackSpeedDisplayValue();

    return (
      <div id="stat-row-attackSpeed" className="secondary-stat-row">
        <div className="secondary-stat-icon">{secondaryStatIcons.attackSpeed}</div>
        <div className="secondary-stat-name">Attack Speed</div>
        <div id="attackSpeed-value" className="secondary-stat-value">
          {displayValue}
        </div>
      </div>
    );
  };

  const MoveSpeedStatRow: React.FC = () => {
    const totalMoveSpeed = calculatedStats.totalMoveSpeed;
    const baseMoveSpeed = 250;
    const moveSpeed = Math.round(totalMoveSpeed / baseMoveSpeed);

    return (
      <div id="stat-row-moveSpeed" className="secondary-stat-row">
        <div className="secondary-stat-icon">{secondaryStatIcons.moveSpeed}</div>
        <div className="secondary-stat-name">Movement Speed</div>
        <div id="moveSpeed-value" className="secondary-stat-value">
          {moveSpeed}
        </div>
      </div>
    );
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

        <div className="skills-window-content">
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

          {/* Main Skills Tab */}
          {activeTab === SkillTab.MAIN && (
            <div className="skills-wrapper">
              <SkillRow
                skillId="playerLevel"
                skillName="Level"
                skill={getSkillData("playerLevel")}
                bonusLevel={getSkillBonus("playerLevel")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="meleeWeapons"
                skillName="Melee Weapons"
                skill={getSkillData("meleeWeapons")}
                bonusLevel={getSkillBonus("meleeWeapons")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="archery"
                skillName="Archery"
                skill={getSkillData("archery")}
                bonusLevel={getSkillBonus("archery")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="magic"
                skillName="Magic"
                skill={getSkillData("magic")}
                bonusLevel={getSkillBonus("magic")}
                onMouseEnter={handleSkillMouseEnter}
                onMouseLeave={handleSkillMouseLeave}
              />

              <SkillRow
                skillId="shield"
                skillName="Shield"
                skill={getSkillData("shield")}
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
                    {calculatedStats.totalPower}
                  </div>
                </div>

                <div className="stat-row">
                  <div className="stat-name">Armor</div>
                  <div id="total-armor" className="stat-value">
                    {calculatedStats.totalArmor}
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
                    baseValue={getTotalStatValue("health")}
                    icon={secondaryStatIcons.health}
                  />

                  <SecondaryStatRow
                    statId="mana"
                    statName="Mana"
                    baseValue={getTotalStatValue("mana")}
                    icon={secondaryStatIcons.mana}
                  />

                  <SecondaryStatRow
                    statId="capacity"
                    statName="Capacity"
                    baseValue={getTotalStatValue("capacity")}
                    icon={secondaryStatIcons.capacity}
                  />
                </div>

                {/* Combat Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Combat Stats</h4>

                  <SecondaryStatRow
                    statId="power"
                    statName="Power"
                    baseValue={getTotalStatValue("power")}
                    icon={secondaryStatIcons.power}
                  />

                  <SecondaryStatRow
                    statId="armor"
                    statName="Armor"
                    baseValue={getTotalStatValue("armor")}
                    icon={secondaryStatIcons.armor}
                  />

                  {/* Custom Attack Speed Display */}
                  <AttackSpeedStatRow />
                </div>
              </div>

              <div className="secondary-stats-grid">
                {/* Regeneration Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Regeneration</h4>

                  <SecondaryStatRow
                    statId="healthRegen"
                    statName="Health Regen"
                    baseValue={getTotalStatValue("healthRegen")}
                    icon={secondaryStatIcons.healthRegen}
                  />

                  <SecondaryStatRow
                    statId="manaRegen"
                    statName="Mana Regen"
                    baseValue={getTotalStatValue("manaRegen")}
                    icon={secondaryStatIcons.manaRegen}
                  />
                </div>

                {/* Movement Stats Section */}
                <div className="secondary-stats-section">
                  <h4 className="secondary-stats-header">Misc</h4>

                  <MoveSpeedStatRow />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tooltip */}
        {tooltipState.visible && getSkillData(tooltipState.skillId) && (
          <SkillTooltip
            skillId={tooltipState.skillId}
            skill={getSkillData(tooltipState.skillId)}
            visible={tooltipState.visible}
            position={tooltipState.position}
          />
        )}
      </div>
    </div>
  );
};

export default SkillsWindow;
