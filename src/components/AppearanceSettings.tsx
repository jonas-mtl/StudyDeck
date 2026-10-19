import { Laptop, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../lib/useTheme";

export function AppearanceSettings({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const modes: {
    id: ThemeMode;
    label: string;
    description: string;
    icon: typeof Sun;
  }[] = [
    {
      id: "system",
      label: "System",
      description: "Übernimmt das macOS-/Windows-Design",
      icon: Laptop,
    },
    { id: "light", label: "Hell", description: "Helle Oberflächen", icon: Sun },
    {
      id: "dark",
      label: "Dunkel",
      description: "Graphitfarbener Dark Mode",
      icon: Moon,
    },
  ];
  return (
    <div className="appearance-settings">
      <div className="settings-section-heading">
        <Moon size={21} />
        <div>
          <h3>Darstellung</h3>
          <p>
            Wähle das Aussehen von StudyDeck. Die Auswahl bleibt auf diesem
            Gerät gespeichert.
          </p>
        </div>
      </div>
      <div
        className="appearance-choices"
        role="radiogroup"
        aria-label="Farbschema"
      >
        {modes.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            className={`appearance-choice ${theme === id ? "chosen" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={22} />
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <p className="settings-small-note">
        Im Systemmodus passt sich StudyDeck automatisch an Änderungen des
        Betriebssystems an.
      </p>
    </div>
  );
}
