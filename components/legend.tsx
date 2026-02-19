"use client";

import type { ViewType } from "@/lib/types";
import { LEGENDS } from "@/lib/views";

export function Legend({ view }: { view: ViewType }): React.ReactElement {
  const items = LEGENDS[view] ?? [];

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-[rgba(15,15,25,0.85)] border border-[#222] rounded-[10px] p-4 text-[11px] backdrop-blur-xl">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          {item.color && (
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
