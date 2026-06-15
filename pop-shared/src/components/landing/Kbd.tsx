/** Inline keyboard shortcut badges used across landing-page copy. */

export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-block bg-foreground/10 px-1.5 py-0.5 font-display text-xs font-bold text-foreground tracking-wide rounded-md mx-0.5 align-baseline">
    {children}
  </kbd>
);

export const HotkeyBadge = ({ shortcut }: { shortcut: string }) => (
  <>
    {shortcut.split(" + ").map((part, index) => (
      <span key={`${shortcut}-${part}-${index}`}>
        {index > 0 ? "+" : null}
        <Kbd>{part}</Kbd>
      </span>
    ))}
  </>
);
