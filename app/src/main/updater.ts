/**
 * PopSuite auto-update — LAUNCHER-ONLY.
 *
 * The launcher (PopSuite.exe, no args) is the natural home for auto-update: it is
 * always resident, owns the single unified tray, and can gracefully quit every
 * module before installing. The module processes NEVER check for updates; they
 * only tear themselves down when the launcher asks them to over the pipe.
 *
 * Flow:
 *   - A few seconds after ready (non-blocking) and every 4 hours thereafter, ask
 *     GitHub Releases for a newer version and silently download it when found.
 *   - On download complete, remember the version and notify the launcher so it can
 *     add a "Restart to Update (x.y.z)" item to the tray menu. Clicking that item
 *     runs installUpdate(), which quits the modules first (via the launcher's
 *     quitAll pipe machinery) and THEN calls quitAndInstall.
 *   - A manual "Check for Updates" path reports back whether anything was found so
 *     the launcher can show a "You're on the latest version." dialog.
 *
 * All failure modes are silent-logged, never dialog-spammed: offline, rate-limit,
 * and — importantly — "no published release yet" (the repo has no releases until
 * the first v* tag ships, so every startup before then hits that case).
 *
 * In dev (!app.isPackaged) the updater no-ops entirely: electron-updater has no
 * app-update.yml to read and would throw, so there is nothing to do.
 */

import { app } from "electron";
import { autoUpdater } from "electron-updater";

/** Re-check cadence after the initial post-launch check. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
/** Delay the first check so it never competes with startup/module spawning. */
const INITIAL_CHECK_DELAY_MS = 8 * 1000; // 8 seconds

export interface SuiteUpdater {
  /** Downloaded-and-ready version, or null if no update is staged. */
  readonly readyVersion: string | null;
  /** Kick off the initial delayed check + the recurring interval. Idempotent. */
  start(): void;
  /**
   * Trigger an immediate check. Resolves to the result so the caller can show a
   * "latest version" dialog when nothing is found. Never rejects.
   */
  checkNow(): Promise<ManualCheckResult>;
  /**
   * Install a downloaded update. Returns false if nothing is staged. When staged,
   * runs the caller-supplied graceful shutdown (quit the modules over the pipe)
   * and then quitAndInstall after the modules have had time to receive quit.
   */
  installUpdate(quitModulesFirst: () => void): boolean;
  /** Clear the interval. */
  dispose(): void;
}

/** Result of a manual "Check for Updates" click. */
export type ManualCheckResult =
  | { status: "downloading"; version: string }
  | { status: "ready"; version: string }
  | { status: "up-to-date" }
  | { status: "unavailable" };

/**
 * Wait this long after quitting the modules before quitAndInstall, mirroring the
 * launcher's own quitAll flush window (it sends quit then app.quit after 200ms).
 * The modules need their will-quit teardown to run first — especially PopKey's
 * uiohook, which must release its native input hook cleanly.
 */
const QUIT_FLUSH_MS = 400;

/**
 * Create the launcher's updater. `onUpdateReady` fires once an update has fully
 * downloaded so the launcher can rebuild the tray menu with the restart item.
 */
export function createSuiteUpdater(onUpdateReady: () => void): SuiteUpdater {
  let readyVersion: string | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let started = false;

  // Silent download: we surface readiness via the tray, not a dialog. We also
  // do NOT auto-install on quit — installing must be an explicit user choice that
  // first tears the modules down, so keep the app quit path clean.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (m: unknown) => console.log(`PopSuite updater: ${String(m)}`),
    warn: (m: unknown) => console.warn(`PopSuite updater: ${String(m)}`),
    error: (m: unknown) => console.error(`PopSuite updater: ${String(m)}`),
    debug: () => {},
  };

  autoUpdater.on("update-downloaded", (info) => {
    readyVersion = info.version;
    onUpdateReady();
  });

  // Never dialog-spam: log every failure and carry on. "No published release"
  // arrives here as an error until the first release exists.
  autoUpdater.on("error", (err) => {
    console.error(`PopSuite updater error: ${String(err)}`);
  });

  function enabled(): boolean {
    return app.isPackaged;
  }

  // Windows-only automatic checking. We DO publish latest-mac.yml/latest-linux.yml
  // (the suite is now built and published for all three OSes — see
  // .github/workflows/release.yml), so electron-updater's manual checkForUpdates()
  // works fine cross-platform. But our mac/linux builds are unsigned (no Apple
  // signing identity, no Linux code-signing cert): quitAndInstall on an unsigned
  // mac build is unreliable/unsupported by electron-updater, and we have no
  // hardware to validate the mac/linux update+relaunch path before this release.
  // Rather than risk a silent background download+install attempt failing or
  // behaving oddly on hardware we can't test, the automatic background check
  // (start()/runCheck()) is restricted to win32. Manual "Check for Updates"
  // (checkNow()) is left enabled on every platform: worst case it reports
  // "unavailable"/"up-to-date" via the same handled paths already used today, and
  // if it does find/download an update, installUpdate() is still gated behind an
  // explicit user click.
  function autoCheckEnabled(): boolean {
    return enabled() && process.platform === "win32";
  }

  async function runCheck(): Promise<void> {
    if (!autoCheckEnabled()) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error(`PopSuite updater check failed: ${String(err)}`);
    }
  }

  return {
    get readyVersion(): string | null {
      return readyVersion;
    },

    start(): void {
      if (started || !autoCheckEnabled()) return;
      started = true;
      setTimeout(() => void runCheck(), INITIAL_CHECK_DELAY_MS);
      interval = setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    },

    async checkNow(): Promise<ManualCheckResult> {
      if (!enabled()) return { status: "unavailable" };
      if (readyVersion) return { status: "ready", version: readyVersion };
      try {
        const result = await autoUpdater.checkForUpdates();
        // A null/missing updateInfo or a version equal to ours means we're current.
        const version = result?.updateInfo?.version;
        if (!version || version === app.getVersion()) {
          return { status: "up-to-date" };
        }
        // Found a newer version: autoDownload is on, so it's downloading now. The
        // tray item appears once "update-downloaded" fires.
        return { status: "downloading", version };
      } catch (err) {
        console.error(`PopSuite updater manual check failed: ${String(err)}`);
        return { status: "unavailable" };
      }
    },

    installUpdate(quitModulesFirst: () => void): boolean {
      if (!readyVersion) return false;
      // Quit the modules first so they run their will-quit teardown (PopKey's
      // uiohook release, overlay windows), then install once the quit messages
      // have flushed over the pipe. Mirrors quitAll's own flush timing.
      quitModulesFirst();
      setTimeout(() => {
        // isSilent=false shows the NSIS progress; isForceRunAfter relaunches the
        // suite (the launcher) after install so the tray comes back.
        autoUpdater.quitAndInstall(false, true);
      }, QUIT_FLUSH_MS);
      return true;
    },

    dispose(): void {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}
