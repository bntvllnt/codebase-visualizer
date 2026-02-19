"use client";

import { useReducer, useCallback } from "react";
import { DEFAULT_CONFIG, type GraphConfig } from "@/lib/types";

type ConfigAction =
  | { type: "set"; key: keyof GraphConfig; value: number | string | boolean }
  | { type: "reset" };

function configReducer(state: GraphConfig, action: ConfigAction): GraphConfig {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "reset":
      return DEFAULT_CONFIG;
  }
}

export function useGraphConfig(): {
  config: GraphConfig;
  setConfig: (key: keyof GraphConfig, value: number | string | boolean) => void;
  resetConfig: () => void;
} {
  const [config, dispatch] = useReducer(configReducer, DEFAULT_CONFIG);

  const setConfig = useCallback(
    (key: keyof GraphConfig, value: number | string | boolean) => {
      dispatch({ type: "set", key, value });
    },
    [],
  );

  const resetConfig = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return { config, setConfig, resetConfig };
}
