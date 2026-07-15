import { useState } from "react";
import { useStore as usePopjotStore } from "@popjot/store/useStore";
import { useStore as usePopkeyStore } from "@popkey/store/useStore";
import { useScaleSync } from "@shared/hooks/useScaleSync";
import { LandingPage } from "@shared/components/landing/LandingPage";
import PopjotEngineShell from "@popjot/engine/EngineShell";
import PopkeyEngineShell from "@popkey/engine/EngineShell";
import { buildSuiteTheme } from "@site/landing/suiteTheme";
import { buildSuiteContent } from "@site/landing/suiteContent";
import EngineToggles from "@site/components/EngineToggles";
import SuiteSettingsPanel from "@site/components/SuiteSettingsPanel";

// The engine toggle badges are pinned to the left edge; the settings FAB sits
// bottom-left by default. PopKey's live keystroke badges render at its
// configured `displayPosition` — when that lands in a bottom corner, push the
// FAB to the OTHER bottom corner so the two never overlap.
const fabStyleFor = (popkeyPosition: string): React.CSSProperties => {
  if (popkeyPosition === "bottom-left") return { bottom: "1.5rem", left: "auto", right: "1.5rem" };
  return { bottom: "1.5rem", left: "1.5rem", right: "auto" };
};

/**
 * PopSuite landing page. Both app engines are mounted simultaneously and each
 * is individually toggleable, mirroring the desktop suite's per-app enable/
 * disable. Landing chrome (palette / menu style / theme) is driven by PopJot's
 * store; each live demo still reflects its own store's settings.
 *
 * Runtime coexistence: PopKey listens on window for key/mouse/scroll and is
 * on by default. PopJot's canvas only mounts (and captures input) once its
 * overlay is activated (hold Alt/Cmd+Shift+A), at which point it takes over —
 * the same "PopJot annotating suppresses PopKey" rule the desktop suite uses.
 */

const SuiteRoot = () => {
  const themeMode = usePopjotStore((s) => s.themeMode);
  const colorPalette = usePopjotStore((s) => s.colorPalette);
  const menuStyle = usePopjotStore((s) => s.menuStyle);
  const buttonRoundness = usePopjotStore((s) => s.buttonRoundness);
  const popjotHotkey = usePopjotStore((s) => s.hotkey);
  const popjotPersistentHotkey = usePopjotStore((s) => s.persistentHotkey);
  const popjotLastToolHotkey = usePopjotStore((s) => s.lastToolHotkey);
  const setPopjotScale = usePopjotStore((s) => s.setScaleFactor);
  const setPopkeyScale = usePopkeyStore((s) => s.setScaleFactor);
  const popkeyDisplayPosition = usePopkeyStore((s) => s.displayPosition);

  useScaleSync(setPopjotScale);
  useScaleSync(setPopkeyScale);

  const [popjotOn, setPopjotOn] = useState(true);
  const [popkeyOn, setPopkeyOn] = useState(true);

  const { theme, card } = buildSuiteTheme({
    themeMode,
    colorPalette,
    menuStyle,
    buttonRoundness,
    fabStyle: fabStyleFor(popkeyDisplayPosition),
  });
  const content = buildSuiteContent({
    card,
    popjotHotkey,
    popjotPersistentHotkey,
    popjotLastToolHotkey,
  });

  return (
    <LandingPage
      content={content}
      theme={theme}
      settingsPanel={<SuiteSettingsPanel popjotOn={popjotOn} popkeyOn={popkeyOn} />}
      navExtras={
        <EngineToggles
          popjotOn={popjotOn}
          popkeyOn={popkeyOn}
          onTogglePopjot={() => setPopjotOn((v) => !v)}
          onTogglePopkey={() => setPopkeyOn((v) => !v)}
          card={card}
        />
      }
      engine={
        <>
          {popjotOn && <PopjotEngineShell />}
          {popkeyOn && <PopkeyEngineShell />}
        </>
      }
    />
  );
};

export default SuiteRoot;
