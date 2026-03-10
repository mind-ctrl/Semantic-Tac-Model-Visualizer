"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { SemanticModel } from "./types";

interface ModelContextValue {
  model: SemanticModel | null;
  setModel: (model: SemanticModel | null) => void;
  reduceToSemantics: boolean;
  toggleSemantics: () => void;
  obfuscateName: (name: string, prefix: string, index?: number) => string;
}

const ModelContext = createContext<ModelContextValue | null>(null);

// Stable obfuscation map so names stay consistent
const obfuscationMap = new Map<string, string>();
let obfuscationCounter = 0;

function getObfuscatedName(name: string, prefix: string): string {
  const key = `${prefix}:${name}`;
  if (!obfuscationMap.has(key)) {
    obfuscationCounter++;
    obfuscationMap.set(key, `${prefix}_${obfuscationCounter}`);
  }
  return obfuscationMap.get(key)!;
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<SemanticModel | null>(null);
  const [reduceToSemantics, setReduceToSemantics] = useState(false);

  const setModel = useCallback((m: SemanticModel | null) => {
    // Reset obfuscation map when new model is loaded
    obfuscationMap.clear();
    obfuscationCounter = 0;
    setModelState(m);
  }, []);

  const toggleSemantics = useCallback(() => {
    setReduceToSemantics((prev) => !prev);
  }, []);

  const obfuscateName = useCallback(
    (name: string, prefix: string) => {
      if (!reduceToSemantics) return name;
      return getObfuscatedName(name, prefix);
    },
    [reduceToSemantics]
  );

  return (
    <ModelContext.Provider
      value={{ model, setModel, reduceToSemantics, toggleSemantics, obfuscateName }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
}
