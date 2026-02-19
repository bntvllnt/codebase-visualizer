"use client";

import { GraphProvider, useGraphContext } from "@/components/graph-provider";
import { GraphCanvas } from "@/components/graph-canvas";
import { ProjectBar } from "@/components/project-bar";
import { ViewTabs } from "@/components/view-tabs";
import { SearchInput } from "@/components/search-input";
import { DetailPanel } from "@/components/detail-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { Legend } from "@/components/legend";

function App(): React.ReactElement | null {
  const {
    graphData,
    forceData,
    projectName,
    isLoading,
    error,
    config,
    setConfig,
    currentView,
    setCurrentView,
    selectedNode,
    setSelectedNode,
    focusNodeId,
    handleNodeClick,
    handleNavigate,
    handleFocus,
    handleSearch,
  } = useGraphContext();

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-[#ef4444] text-center p-10 text-base">
          Failed to load graph data: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !graphData) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-[#888] text-base">Loading codebase graph...</div>
      </div>
    );
  }

  return (
    <>
      <ProjectBar projectName={projectName} graphData={graphData} forceData={forceData} />
      <ViewTabs current={currentView} onChange={setCurrentView} />
      <SearchInput nodes={graphData.nodes} onSearch={handleSearch} />
      <GraphCanvas
        nodes={graphData.nodes}
        edges={graphData.edges}
        config={config}
        currentView={currentView}
        focusNodeId={focusNodeId}
        forceData={forceData}
        circularDeps={graphData.stats.circularDeps}
        onNodeClick={handleNodeClick}
      />
      <DetailPanel
        node={selectedNode}
        edges={graphData.edges}
        onClose={() => { setSelectedNode(null); }}
        onNavigate={handleNavigate}
        onFocus={handleFocus}
      />
      <Legend view={currentView} />
      <SettingsPanel config={config} onChange={setConfig} />
    </>
  );
}

export default function Home(): React.ReactElement {
  return (
    <GraphProvider>
      <App />
    </GraphProvider>
  );
}
