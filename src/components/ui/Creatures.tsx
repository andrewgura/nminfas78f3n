import React, { useState, useEffect } from "react";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";

// Mock data for demonstration
const MOCK_CREATURE_DATA = {
  "decayed-skeleton": {
    id: "decayed-skeleton",
    name: "Decayed Skeleton",
    category: "Undead",
    sprite: "assets/outfit-preview/skeleton-outfit-preview.png",
    health: 12,
    experience: 40,
    killCount: 500,
    loot: [
      { itemName: "Iron Sword", chance: "75%" },
      { itemName: "Bone Fragment", chance: "45%" },
      { itemName: "Rusty Coin", chance: "25%" },
    ],
  },
};

interface CreatureData {
  id: string;
  name: string;
  category: string;
  sprite: string;
  health: number;
  experience: number;
  killCount: number;
  loot: Array<{ itemName: string; chance: string }>;
}

interface ProgressMilestone {
  kills: number;
  reward: string;
  achieved: boolean;
}

const CreatureNavigationItem: React.FC<{
  creature: CreatureData;
  isSelected: boolean;
  onClick: () => void;
}> = ({ creature, isSelected, onClick }) => {
  return (
    <div className={`creature-nav-item ${isSelected ? "selected" : ""}`} onClick={onClick}>
      <div className="creature-nav-image">
        <img src={creature.sprite} alt={creature.name} />
      </div>
      <div className="creature-nav-info">
        <div className="creature-nav-name">{creature.name}</div>
        <div className="creature-nav-category">{creature.category}</div>
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{ killCount: number }> = ({ killCount }) => {
  const milestones: ProgressMilestone[] = [
    { kills: 250, reward: "1% Bonus Damage", achieved: killCount >= 250 },
    { kills: 500, reward: "1% Damage Reduction", achieved: killCount >= 500 },
    { kills: 1000, reward: "2% Bonus Damage & Reduction", achieved: killCount >= 1000 },
    { kills: 1250, reward: "1% Better Loot Chance", achieved: killCount >= 1250 },
  ];

  const maxKills = 1250;
  const progressPercentage = Math.min(100, (killCount / maxKills) * 100);

  return (
    <div className="creature-progress-section">
      <h4>Kill Progress</h4>
      <div className="progress-bar-container">
        <div className="progress-bar-background">
          <div
            className="progress-bar-fill"
            style={{
              width: `${progressPercentage}%`,
              minWidth: progressPercentage > 0 ? "4px" : "0px", // Ensure visibility even for small progress
            }}
          />
          {milestones.map((milestone, index) => {
            const position = (milestone.kills / maxKills) * 100;
            const isLastMilestone = index === milestones.length - 1;
            // Set last milestone to 99% to prevent cutoff at the edge
            const finalPosition = isLastMilestone ? 98 : position;

            return (
              <div
                key={index}
                className={`progress-milestone ${milestone.achieved ? "achieved" : ""} ${isLastMilestone ? "final-milestone" : ""}`}
                style={{ left: `${finalPosition}%` }}
                title={`${milestone.kills} kills: ${milestone.reward}`}
              >
                {milestone.achieved ? "✓" : "○"}
              </div>
            );
          })}
        </div>
      </div>
      <div className="progress-text">
        {killCount} / {maxKills} kills ({Math.round(progressPercentage)}%)
      </div>
      <div className="milestones-list">
        {milestones.map((milestone, index) => (
          <div key={index} className={`milestone-item ${milestone.achieved ? "achieved" : ""}`}>
            <span className="milestone-icon">{milestone.achieved ? "✓" : "○"}</span>
            <span className="milestone-kills">{milestone.kills}</span>
            <span className="milestone-reward">{milestone.reward}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CreatureDetails: React.FC<{ creature: CreatureData }> = ({ creature }) => {
  return (
    <div className="creature-details">
      <div className="creature-header">
        <div className="creature-image-large">
          <img src={creature.sprite} alt={creature.name} />
        </div>
        <div className="creature-basic-info">
          <h2 className="creature-name">{creature.name}</h2>
          <div className="creature-category">{creature.category}</div>
          <div className="creature-stats">
            <div className="stat-row">
              <span className="stat-label">Health:</span>
              <span className="stat-value">{creature.health}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Experience:</span>
              <span className="stat-value">{creature.experience}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Times Killed:</span>
              <span className="stat-value">{creature.killCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="creature-loot-section">
        <h4>Loot Table</h4>
        <div className="loot-items">
          {creature.loot.map((lootItem, index) => (
            <div key={index} className="loot-item">
              <span className="loot-name">{lootItem.itemName}</span>
              <span className="loot-chance">{lootItem.chance}</span>
            </div>
          ))}
        </div>
      </div>

      <ProgressBar killCount={creature.killCount} />
    </div>
  );
};

const Creatures: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState<string>("decayed-skeleton");
  const emitEvent = useEmitEvent();

  // Listen for creatures toggle event
  useEventBus("creatures.toggle", (data: { visible: boolean }) => {
    setVisible(data.visible);
  });

  // Handle close
  const handleClose = () => {
    setVisible(false);
    emitEvent("creatures.visibility.changed", false);
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  if (!visible) {
    return null;
  }

  const creatures = Object.values(MOCK_CREATURE_DATA);
  const currentCreature = MOCK_CREATURE_DATA[selectedCreature as keyof typeof MOCK_CREATURE_DATA];

  return (
    <div className="creatures-container">
      <div className="creatures-header">
        <h2>Creature Compendium</h2>
        <button className="creatures-close-button" onClick={handleClose}>
          ✕
        </button>
      </div>

      <div className="creatures-content">
        <div className="creatures-navigation">
          <h3>Encountered Creatures</h3>
          <div className="creature-nav-list">
            {creatures.map((creature) => (
              <CreatureNavigationItem
                key={creature.id}
                creature={creature}
                isSelected={selectedCreature === creature.id}
                onClick={() => setSelectedCreature(creature.id)}
              />
            ))}
          </div>
        </div>

        <div className="creatures-main">
          {currentCreature && <CreatureDetails creature={currentCreature} />}
        </div>
      </div>
    </div>
  );
};

export default Creatures;
