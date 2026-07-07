import { useState } from "react";
import { X, Monitor, Chrome } from "lucide-react";

const MobileGate = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="w-full bg-pop-orange/10 border-b border-pop-orange/20 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-start gap-4 md:items-center">
        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          <div className="flex-1">
            <p className="font-display text-sm font-bold text-foreground">
              PopJot works best on desktop
            </p>
            <p className="font-body text-xs text-foreground/70 mt-1">
              This demo is optimized for larger screens. Try the Chrome Extension or Desktop app for full functionality.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="#" className="flex items-center gap-2 bg-pop-orange/20 hover:bg-pop-orange/30 px-3 py-2 rounded-lg transition-colors">
              <Monitor className="w-4 h-4 text-foreground" strokeWidth={2} />
              <span className="font-body text-xs font-bold text-foreground">Desktop</span>
            </a>
            <a href="#" className="flex items-center gap-2 bg-pop-yellow/20 hover:bg-pop-yellow/30 px-3 py-2 rounded-lg transition-colors">
              <Chrome className="w-4 h-4 text-foreground" strokeWidth={2} />
              <span className="font-body text-xs font-bold text-foreground">Chrome</span>
            </a>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 hover:bg-foreground/10 rounded-lg transition-colors"
          aria-label="Dismiss mobile notice"
        >
          <X className="w-5 h-5 text-foreground/60" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default MobileGate;
