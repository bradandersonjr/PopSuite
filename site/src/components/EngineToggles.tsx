import { PenLine, Keyboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CardStyle } from "@shared/components/landing/LandingPage";

/**
 * Per-app engine toggles, pinned centered on the left edge. Mirrors the
 * desktop tray's enable/disable checkbox for each app: turning one off
 * unmounts that engine entirely (handled by SuiteRoot).
 */

interface Props {
  popjotOn: boolean;
  popkeyOn: boolean;
  onTogglePopjot: () => void;
  onTogglePopkey: () => void;
  card: (colorIndex: number, slot: number) => CardStyle;
}

const Toggle = ({
  on,
  label,
  icon: Icon,
  onClick,
  card,
  colorIndex,
}: {
  on: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  card: (colorIndex: number, slot: number) => CardStyle;
  colorIndex: number;
}) => {
  const c = card(colorIndex, colorIndex);
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={`${on ? "Disable" : "Enable"} ${label}`}
      className={`${c.className} neo-box-hover flex items-center gap-2 px-3 py-2 cursor-pointer transition-opacity ${on ? "" : "opacity-40 grayscale"}`}
      style={c.style}
    >
      <Icon className="w-4 h-4 text-foreground" strokeWidth={2.5} />
      <span className="font-display text-xs font-bold text-foreground uppercase tracking-wide">
        {label}
      </span>
      <span
        className="ml-1 inline-block h-3 w-3 rounded-full border-2 border-foreground/70"
        style={{ backgroundColor: on ? "currentColor" : "transparent" }}
      />
    </button>
  );
};

const EngineToggles = ({ popjotOn, popkeyOn, onTogglePopjot, onTogglePopkey, card }: Props) => (
  <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-2">
    <Toggle on={popjotOn} label="PopJot" icon={PenLine} onClick={onTogglePopjot} card={card} colorIndex={2} />
    <Toggle on={popkeyOn} label="PopKey" icon={Keyboard} onClick={onTogglePopkey} card={card} colorIndex={1} />
  </div>
);

export default EngineToggles;

