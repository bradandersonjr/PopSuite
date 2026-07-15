# PopSuite unified desktop manual verification

Use a packaged or win-unpacked build. The two public websites are separate Vite
outputs and are not exercised by this desktop checklist.

## Process and window model

1. Launch PopSuite once.

   - Task Manager should show one PopSuite application runtime rather than a
     launcher plus two module main processes.
   - Electron will still create helper processes for graphics, networking, and
     renderers. The current Windows idle baseline is five processes; Electron or
     Windows updates may shift that slightly.
   - No PopSuite command line should contain --module=popjot or --module=popkey.

2. Confirm two independent native overlays.

   - PopJot and PopKey each have their own BrowserWindow and renderer.
   - Activating PopJot must not focus, resize, reload, or toggle PopKey.
   - Toggling PopKey must not focus, resize, reload, or dismiss PopJot.
   - Disabling either tool from the tray must leave the other fully functional.

3. Confirm PopJot remains resident while enabled.

   - Activate momentary drawing, release it, then activate again.
   - Activate persistent drawing, exit with Escape, then activate again.
   - The transparent PopJot surface should remain present between activations.
   - Disabling PopJot hides the surface; re-enabling restores it immediately.

4. Confirm taskbar-safe bounds on Windows.

   - Test the taskbar on the bottom, top, left, and right edges.
   - Test taskbar auto-hide on and off.
   - PopJot and PopKey overlays must use the work area and must not alter,
     discolor, or cover the taskbar.
   - Moving the taskbar or changing display metrics must realign both overlays.

## Independent interaction behavior

5. PopJot drawing focus.

   - With PopKey enabled, hold the PopJot momentary shortcut and draw.
   - The radial menu opens at the cursor and the stroke remains responsive.
   - Release the shortcut and confirm PopJot returns to click-through mode.
   - Repeat in persistent mode and confirm Escape exits only PopJot.

6. PopKey visualization.

   - With PopJot idle, type keys, click, scroll, and drag.
   - PopKey badges and indicators should behave exactly as before.
   - Toggle PopKey off and on with its shortcut and with the tray item.

7. PopJot suppression of PopKey.

   - Enable PopKey, then activate PopJot drawing.
   - PopKey content should hide while PopJot is active.
   - End PopJot and confirm PopKey restores to the previously requested state.
   - While suppressed, toggle PopKey; it must remain hidden until PopJot ends,
     then honor the new requested state.

8. Spotlight and shared native input hook.

   - Enable PopKey and confirm key/click visualization works.
   - Toggle PopJot Spotlight and resize the spotlight with the mouse wheel.
   - Exit Spotlight.
   - Immediately type, click, scroll, and drag again.
   - PopKey input capture must still work; exiting Spotlight must not stop the
     shared native hook.

## Tray and settings

9. Unified tray.

   - Exactly one PopSuite tray icon appears.
   - PopJot and PopKey each have independent enabled state and shortcut hints.
   - About, documentation, changelog, update, open-at-login, and Quit work.

10. Unified settings shell.

    - Open Settings and switch repeatedly between PopJot and PopKey.
    - Task Manager should add one Settings renderer only (six total with the
      current five-process idle baseline). Tab changes reuse that renderer.
    - A PopJot setting must update only PopJot unless that setting is explicitly
      opted into cross-tool sync. Repeat in the other direction.
    - Shortcut changes must update the correct module and tray hint.
    - Close Settings and confirm the process count returns to the idle baseline.
    - Reopen Settings; persisted values should remain correct.

11. Renderer/session isolation.

    - Reload or inspect one overlay during development.
    - The other overlay must remain loaded and responsive.
    - Clipboard, license, settings, and shortcut IPC from the selected panel must
      never resolve against the other module's namespace.

## Lifecycle

12. Launch PopSuite a second time.

    - No duplicate runtime or tray icon should remain.
    - The existing Settings window should open and focus.

13. Quit PopSuite.

    - Both overlays, the native input hook, helper processes, Settings window,
      and tray icon should exit together.
    - Relaunch and confirm both module settings remain intact.

14. Update/install path.

    - A downloaded update should quit the unified runtime once and restart one
      PopSuite instance.
    - Open-at-login should register PopSuite without module arguments.

## Website independence

15. Build the two websites from the repository root.

    - PopJot and PopKey produce separate dist directories.
    - Neither site imports Electron-only runtime code.
    - Desktop IPC/session changes must not alter either public site.