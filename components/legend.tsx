"use client";

import type { ViewType, GroupMetrics } from "@/lib/types";
import { LEGENDS } from "@/lib/views";

export function Legend({
  view,
  groups,
  showClouds,
}: {
  view: ViewType;
  groups: GroupMetrics[] | undefined;
  showClouds: boolean;
}): React.ReactElement {
  const items = LEGENDS[view] ?? [];
  const showGroups = showClouds && groups && groups.length > 0;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-[rgba(15,15,25,0.85)] border border-[#222] rounded-[10px] p-4 text-[11px] backdrop-blur-xl max-w-[260px]">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          {item.color && (
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
      {showGroups && (
        <>
          <div className="border-t border-[#333] my-2" />
          <div className="text-[10px] text-[#666] mb-1 uppercase tracking-wider">Groups</div>
          {groups.map((g) => (
            <div key={g.name} className="flex items-center gap-2 py-0.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                style={{ backgroundColor: g.color }}
              />
              <span className="truncate">{g.name}</span>
              <span className="text-[#555] ml-auto shrink-0">
                {g.files}f {(g.importance * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
