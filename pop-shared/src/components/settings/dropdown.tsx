/**
 * Dropdown-menu settings primitives (used by PopJot's web-mode tray menu).
 * Thin styling layer over the shared shadcn dropdown-menu.
 */

import {
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@shared/components/ui/dropdown-menu";
import type { Option } from "./primitives";

export interface MenuColorProps {
  menuText: string;
  menuHoverBg: string;
  menuHoverText: string;
  menuBg: string;
  menuBorder: string;
}

export const focusHoverHandlers = (
  menuHoverBg: string,
  menuHoverText: string,
  menuText: string
) => ({
  onFocus: (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = menuHoverBg;
    e.currentTarget.style.color = menuHoverText;
  },
  onBlur: (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.backgroundColor = "transparent";
    e.currentTarget.style.color = menuText;
  },
});

export const renderCheckboxItems = <T,>(
  options: Option<T>[],
  menuText: string,
  menuHoverBg: string,
  menuHoverText: string,
  colorMap?: Record<string, string>
) =>
  options.map((option) => {
    const optionColor = colorMap?.[option.label];
    return (
      <DropdownMenuCheckboxItem
        key={option.label}
        checked={option.checked}
        onCheckedChange={() => option.onSelect(option.value)}
        onSelect={(e) => e.preventDefault()}
        style={{ color: menuText }}
        className="focus:text-white flex items-center gap-2"
        {...focusHoverHandlers(menuHoverBg, menuHoverText, menuText)}
      >
        {optionColor && (
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: optionColor }} />
        )}
        {option.label}
      </DropdownMenuCheckboxItem>
    );
  });

export const SubMenuSection = <T,>({
  label,
  options,
  menuText,
  menuHoverBg,
  menuHoverText,
  menuBg,
  menuBorder,
  colorMap,
}: {
  label: string;
  options: Option<T>[];
  colorMap?: Record<string, string>;
} & MenuColorProps) => (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger
      style={{ color: menuText }}
      className="focus:text-white"
      {...focusHoverHandlers(menuHoverBg, menuHoverText, menuText)}
    >
      {label}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent
      style={{ borderColor: menuBorder, backgroundColor: menuBg, color: menuText }}
    >
      {renderCheckboxItems(options, menuText, menuHoverBg, menuHoverText, colorMap)}
    </DropdownMenuSubContent>
  </DropdownMenuSub>
);
