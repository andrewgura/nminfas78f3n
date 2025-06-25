import React from "react";
import { useGameStore } from "../../stores/gameStore";

interface ResourceDisplayProps {
  icon: string;
  label: string;
  className?: string;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({ icon, label, className = "" }) => {
  const { playerCharacter } = useGameStore();

  return (
    <div className={`resource-gold ${className}`}>
      <span className="resource-icon">{icon}</span>
      <span className="resource-label">{label}</span>
      <span className="resource-value">{playerCharacter.gold}</span>
    </div>
  );
};

export default ResourceDisplay;
