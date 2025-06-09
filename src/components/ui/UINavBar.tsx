import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEmitEvent, useEventBus } from "../../hooks/useEventBus";

// Define different navigation button types
export enum NavButtonType {
  QUESTS = "quests",
  SET_COLLECTION = "setCollection",
  ABILITIES = "abilities",
  BACKPACK = "backpack",
  SKILLS = "skills",
  CREATURES = "creatures", // Added creatures button
}

// Props for individual navigation button
interface NavButtonProps {
  type: NavButtonType;
  icon: string;
  label: string;
  isActive?: boolean;
  onClick: (type: NavButtonType) => void;
  shortcutKey?: string;
}

// Individual navigation button component
const NavButton: React.FC<NavButtonProps> = ({
  type,
  icon,
  label,
  isActive = false,
  onClick,
  shortcutKey,
}) => {
  return (
    <div
      className={`nav-button-container ${isActive ? "active" : ""}`}
      onClick={() => onClick(type)}
      title={shortcutKey ? `${label} (${shortcutKey})` : label}
    >
      <div className="nav-button">
        <span className="nav-button-icon">{icon}</span>
      </div>
      <div className="nav-button-label">{label}</div>
    </div>
  );
};

// Main UINavBar component
const UINavBar: React.FC = () => {
  const [activeButtons, setActiveButtons] = useState<Record<NavButtonType, boolean>>({
    [NavButtonType.QUESTS]: false,
    [NavButtonType.SET_COLLECTION]: false,
    [NavButtonType.ABILITIES]: false,
    [NavButtonType.BACKPACK]: false,
    [NavButtonType.SKILLS]: false,
    [NavButtonType.CREATURES]: false, // Added creatures state
  });

  // Skills window state
  const [skillsWindowOpen, setSkillsWindowOpen] = useState(false);
  const { playerCharacter } = useGameStore();
  const emitEvent = useEmitEvent();

  // Button configurations
  const navButtons = [
    {
      type: NavButtonType.QUESTS,
      icon: "📜",
      label: "Quests",
      event: "quests.toggle",
      shortcutKey: "P",
    },
    {
      type: NavButtonType.SET_COLLECTION,
      icon: "🏆",
      label: "Sets",
      event: "setCollection.toggle",
      shortcutKey: "L",
    },
    {
      type: NavButtonType.ABILITIES,
      icon: "✨",
      label: "Abilities",
      event: "abilities.toggle",
      shortcutKey: "O",
    },
    {
      type: NavButtonType.SKILLS,
      icon: "📊",
      label: "Skills",
      event: "skills.toggle",
      shortcutKey: "K",
    },
    {
      type: NavButtonType.CREATURES,
      icon: "🐉",
      label: "Creatures",
      event: "creatures.toggle",
      shortcutKey: "C",
    },
  ];

  // Handle button click
  const handleButtonClick = (buttonType: NavButtonType) => {
    // Toggle the active state
    const newState = !activeButtons[buttonType];

    // Update active state
    setActiveButtons((prev) => ({
      ...prev,
      [buttonType]: newState,
    }));

    // Find the button config
    const buttonConfig = navButtons.find((btn) => btn.type === buttonType);

    // Emit the toggle event if found
    if (buttonConfig) {
      emitEvent(buttonConfig.event, { visible: newState });
    }
  };

  // Set up keyboard shortcuts for buttons
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if an input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Find matching button
      const buttonConfig = navButtons.find((btn) => btn.shortcutKey?.toLowerCase() === key);
      if (buttonConfig) {
        handleButtonClick(buttonConfig.type);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [activeButtons]);

  // Listen for external skill window toggle events
  useEventBus("skills.visibility.changed", (isVisible: boolean) => {
    setActiveButtons((prev) => ({
      ...prev,
      [NavButtonType.SKILLS]: isVisible,
    }));
    setSkillsWindowOpen(isVisible);
  });

  // Listen for creatures window toggle events
  useEventBus("creatures.visibility.changed", (isVisible: boolean) => {
    setActiveButtons((prev) => ({
      ...prev,
      [NavButtonType.CREATURES]: isVisible,
    }));
  });

  return (
    <div className="nav-buttons-grid">
      {navButtons.map((button) => (
        <NavButton
          key={button.type}
          type={button.type}
          icon={button.icon}
          label={button.label}
          isActive={activeButtons[button.type]}
          onClick={handleButtonClick}
          shortcutKey={button.shortcutKey}
        />
      ))}
    </div>
  );
};

export default UINavBar;
