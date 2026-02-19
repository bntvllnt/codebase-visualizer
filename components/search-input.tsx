"use client";

import { useState, useCallback, type ChangeEvent } from "react";
import type { GraphApiNode } from "@/lib/types";

export function SearchInput({
  nodes,
  onSearch,
}: {
  nodes: GraphApiNode[];
  onSearch: (nodeId: string) => void;
}): React.ReactElement {
  const [query, setQuery] = useState("");

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      const q = value.toLowerCase();
      if (!q) return;
      const match = nodes.find(
        (n) => n.path.toLowerCase().includes(q) || n.label.toLowerCase().includes(q),
      );
      if (match) onSearch(match.id);
    },
    [nodes, onSearch],
  );

  return (
    <input
      type="text"
      placeholder="Search files..."
      value={query}
      onChange={handleChange}
      className="fixed top-3 right-4 z-[100] px-4 py-2 text-xs bg-[rgba(10,10,15,0.85)] text-[#e0e0e0] border border-[#222] rounded-[10px] outline-none w-[200px] backdrop-blur-xl focus:border-[#2563eb]"
    />
  );
}
