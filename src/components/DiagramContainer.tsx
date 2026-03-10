"use client";

import { useState, forwardRef, useImperativeHandle, useCallback } from "react";
import dynamic from "next/dynamic";
import { exportDiagramAsPng, exportDiagramAsSvg } from "@/lib/export-diagram";
import ExplorePanel from "./ExplorePanel";

const ErdDiagram = dynamic(() => import("./diagrams/ErdDiagram"), { ssr: false });
const StarSchemaDiagram = dynamic(() => import("./diagrams/StarSchemaDiagram"), { ssr: false });
const DataSourcesDiagram = dynamic(() => import("./diagrams/DataSourcesDiagram"), { ssr: false });
const RlsFlowDiagram = dynamic(() => import("./diagrams/RlsFlowDiagram"), { ssr: false });
const CalcGroupDiagram = dynamic(() => import("./diagrams/CalcGroupDiagram"), { ssr: false });

type DiagramTab = "erd" | "starSchema" | "dataSources" | "rlsRoles" | "calcGroups";

export interface DiagramContainerHandle {
  setDiagramTab: (tab: string) => void;
}

const tabs: { id: DiagramTab; label: string; shortcut: string; iconPath: string }[] = [
  { id: "erd", label: "ERD", shortcut: "1", iconPath: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { id: "starSchema", label: "Star Schema", shortcut: "2", iconPath: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { id: "dataSources", label: "Sources", shortcut: "3", iconPath: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { id: "rlsRoles", label: "RLS", shortcut: "4", iconPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { id: "calcGroups", label: "Calc Groups", shortcut: "5", iconPath: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
];

const DiagramContainer = forwardRef<DiagramContainerHandle>(function DiagramContainer(_, ref) {
  const [activeTab, setActiveTab] = useState<DiagramTab>("erd");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useImperativeHandle(ref, () => ({
    setDiagramTab: (tab: string) => {
      const valid = tabs.find((t) => t.id === tab);
      if (valid) setActiveTab(valid.id);
    },
  }));

  const handleNodeClick = useCallback((tableName: string) => {
    setSelectedTable((prev) => (prev === tableName ? null : tableName));
  }, []);

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* Collapsible sidebar */}
      <div
        className={`bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col shrink-0 transition-all duration-200 ${
          sidebarOpen ? "w-44" : "w-12"
        }`}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center justify-center h-9 border-b border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            )}
          </svg>
        </button>

        {/* Tab buttons */}
        <div className="p-2 space-y-1 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={sidebarOpen ? undefined : tab.label}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                activeTab === tab.id
                  ? "bg-[var(--color-primary)]/12 text-[var(--color-primary-light)] border border-[var(--color-primary)]/20"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] border border-transparent"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.iconPath} />
              </svg>
              {sidebarOpen && (
                <>
                  <span className="truncate">{tab.label}</span>
                  <kbd className={`ml-auto text-[9px] px-1 py-0.5 rounded font-mono ${
                    activeTab === tab.id
                      ? "bg-[var(--color-primary)]/20 text-[var(--color-primary-light)]"
                      : "bg-[var(--color-surface-light)] text-[var(--color-text-dim)]"
                  }`}>
                    {tab.shortcut}
                  </kbd>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Export section at bottom */}
        <div className="p-2 border-t border-[var(--color-border)] space-y-1">
          {sidebarOpen && (
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] px-2.5 mb-2">Export</div>
          )}
          <button
            onClick={() => exportDiagramAsPng(tabs.find(t => t.id === activeTab)!.label)}
            title={sidebarOpen ? undefined : "Save as PNG"}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {sidebarOpen && "Save as PNG"}
          </button>
          <button
            onClick={() => exportDiagramAsSvg(tabs.find(t => t.id === activeTab)!.label)}
            title={sidebarOpen ? undefined : "Save as SVG"}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-light)] transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {sidebarOpen && "Save as SVG"}
          </button>
        </div>
      </div>

      {/* Diagram area */}
      <div className="flex-1 flex relative">
        <div className="flex-1 relative">
          {activeTab === "erd" && <ErdDiagram onNodeClick={handleNodeClick} selectedTable={selectedTable} />}
          {activeTab === "starSchema" && <StarSchemaDiagram onNodeClick={handleNodeClick} selectedTable={selectedTable} />}
          {activeTab === "dataSources" && <DataSourcesDiagram />}
          {activeTab === "rlsRoles" && <RlsFlowDiagram />}
          {activeTab === "calcGroups" && <CalcGroupDiagram />}
        </div>

        {/* Explore panel */}
        {selectedTable && (activeTab === "erd" || activeTab === "starSchema") && (
          <ExplorePanel
            selectedTable={selectedTable}
            onClose={() => setSelectedTable(null)}
          />
        )}
      </div>
    </div>
  );
});

export default DiagramContainer;
