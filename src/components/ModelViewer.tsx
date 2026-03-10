"use client";

import { useState, useMemo, useRef } from "react";
import { useModel } from "@/lib/model-context";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { exportModelAsHtml } from "@/lib/export-report";
import ModelSummary from "./ModelSummary";
import RelationshipsView from "./RelationshipsView";
import RlsDisplay from "./RlsDisplay";
import ColumnDetails from "./ColumnDetails";
import DiagramContainer, { type DiagramContainerHandle } from "./DiagramContainer";
import HealthDashboard from "./HealthDashboard";
import OlsDisplay from "./OlsDisplay";

type Tab = "summary" | "diagrams" | "health";

const diagramTabKeys = ["erd", "starSchema", "dataSources", "rlsRoles", "calcGroups"] as const;

const navItems: { id: Tab; label: string; iconPath: string }[] = [
  {
    id: "summary",
    label: "Model Overview",
    iconPath: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "diagrams",
    label: "Diagrams",
    iconPath: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
  {
    id: "health",
    label: "DAX Complexity",
    iconPath: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
];

export default function ModelViewer() {
  const { model, setModel, reduceToSemantics, toggleSemantics, obfuscateName } = useModel();
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const diagramContainerRef = useRef<DiagramContainerHandle>(null);

  const shortcuts = useMemo(
    () => ({
      s: () => setActiveTab("summary"),
      d: () => setActiveTab("diagrams"),
      h: () => setActiveTab("health"),
      p: () => toggleSemantics(),
      "?": () =>
        alert(
          "Keyboard Shortcuts:\n" +
            "s - Overview tab\n" +
            "d - Diagrams tab\n" +
            "h - Health tab\n" +
            "1-5 - Switch diagram (ERD, Star, Sources, RLS, Calc Groups)\n" +
            "p - Toggle privacy mode\n" +
            "? - Show this help"
        ),
      "1": () => { setActiveTab("diagrams"); diagramContainerRef.current?.setDiagramTab(diagramTabKeys[0]); },
      "2": () => { setActiveTab("diagrams"); diagramContainerRef.current?.setDiagramTab(diagramTabKeys[1]); },
      "3": () => { setActiveTab("diagrams"); diagramContainerRef.current?.setDiagramTab(diagramTabKeys[2]); },
      "4": () => { setActiveTab("diagrams"); diagramContainerRef.current?.setDiagramTab(diagramTabKeys[3]); },
      "5": () => { setActiveTab("diagrams"); diagramContainerRef.current?.setDiagramTab(diagramTabKeys[4]); },
    }),
    [toggleSemantics]
  );

  useKeyboardShortcuts(shortcuts);

  if (!model) return null;

  const displayName = obfuscateName(model.name, "Model");

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-48 bg-(--color-surface) border-r border-(--color-border) flex flex-col py-4 shrink-0">
        {/* Logo */}
        <button
          onClick={() => setModel(null)}
          className="flex items-center gap-2.5 px-4 mb-6 hover:opacity-80 transition-opacity"
          title="Back to upload"
        >
          <div className="w-8 h-8 rounded-lg gradient-border bg-(--color-surface) flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-(--color-primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gradient">Semantic-tac</span>
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left relative ${
                activeTab === item.id
                  ? "bg-(--color-primary)/15 text-(--color-primary-light)"
                  : "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-light)"
              }`}
            >
              {activeTab === item.id && (
                <div className="absolute left-0 w-0.5 h-5 rounded-r bg-(--color-primary)" />
              )}
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
              </svg>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 mt-auto px-3">
          <button
            onClick={toggleSemantics}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
              reduceToSemantics
                ? "bg-accent-purple/15 text-(--color-accent-purple)"
                : "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-light)"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {reduceToSemantics ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              )}
            </svg>
            <span>Privacy Mode</span>
          </button>

          <button
            onClick={() => exportModelAsHtml(model)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-light) transition-all text-left"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export Report</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-[var(--color-text)]">{displayName}</h1>
            <div className="h-4 w-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-dim)]">
              {model.tables.length} tables &middot; {model.relationships.length} relationships
            </span>
          </div>
          <div className="flex items-center gap-3">
            {reduceToSemantics && (
              <span className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] font-medium">
                Privacy On
              </span>
            )}
            <span className="text-xs text-[var(--color-text-dim)]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-light)] text-[var(--color-text-muted)] font-mono text-[10px]">?</kbd> for shortcuts
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === "summary" && (
            <div className="max-w-6xl mx-auto p-6 space-y-6">
              <ModelSummary />
              <RelationshipsView />
              <RlsDisplay />
              <OlsDisplay />
              <ColumnDetails />
            </div>
          )}
          {activeTab === "diagrams" && <DiagramContainer ref={diagramContainerRef} />}
          {activeTab === "health" && <HealthDashboard />}
        </main>
      </div>
    </div>
  );
}
