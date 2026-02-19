"use client";

import type { GraphApiResponse, ForceApiResponse } from "@/lib/types";
import { complexityLabel } from "@/lib/views";

function Stat({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-[#888] text-[11px]">
      {label}
      <span className="text-[#e0e0e0] font-medium">{children}</span>
    </div>
  );
}

export function ProjectBar({
  projectName,
  graphData,
  forceData,
}: {
  projectName: string;
  graphData: GraphApiResponse | undefined;
  forceData: ForceApiResponse | undefined;
}): React.ReactElement {
  if (!graphData) {
    return (
      <div className="fixed top-3 left-4 z-[100] p-4 bg-[rgba(10,10,15,0.85)] border border-[#222] rounded-[10px] backdrop-blur-xl">
        <h1 className="text-sm font-semibold text-white">Loading...</h1>
      </div>
    );
  }

  const fileNodes = graphData.nodes;
  const testedCount = fileNodes.filter((n) => n.hasTests).length;
  const totalFiles = fileNodes.length || 1;
  const coveragePct = Math.round((testedCount / totalFiles) * 100);
  const totalDead = fileNodes.reduce((sum, n) => sum + n.deadExports.length, 0);
  const avgComplexity = fileNodes.reduce((sum, n) => sum + n.cyclomaticComplexity, 0) / totalFiles;
  const cxLabel = complexityLabel(avgComplexity);

  return (
    <div className="fixed top-3 left-4 z-[100] p-4 bg-[rgba(10,10,15,0.85)] border border-[#222] rounded-[10px] backdrop-blur-xl">
      <h1 className="text-sm font-semibold text-white whitespace-nowrap mb-2.5">{projectName}</h1>
      <Stat label="Files">{graphData.stats.totalFiles}</Stat>
      <Stat label="Functions">{graphData.stats.totalFunctions}</Stat>
      <Stat label="Dependencies">{graphData.stats.totalDependencies}</Stat>
      <Stat label="Circular">{graphData.stats.circularDeps.length}</Stat>
      <div className="h-px bg-[#333] my-2" />
      <Stat label="Test Coverage">
        <span style={{ color: coveragePct >= 60 ? "#16a34a" : coveragePct >= 30 ? "#ca8a04" : "#dc2626" }}>
          {testedCount}/{totalFiles} ({coveragePct}%)
        </span>
      </Stat>
      <Stat label="Dead Exports">{totalDead}</Stat>
      <Stat label="Avg Complexity">
        <span style={{ color: cxLabel.color }}>
          {avgComplexity.toFixed(1)} — {cxLabel.text}
        </span>
      </Stat>
      <Stat label="Tension Files">{forceData?.tensionFiles.length ?? 0}</Stat>
      <Stat label="Bridges">{forceData?.bridgeFiles.length ?? 0}</Stat>
    </div>
  );
}
