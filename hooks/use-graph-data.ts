import useSWR from "swr";
import type { GraphApiResponse, ForceApiResponse } from "@/lib/types";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useGraphData(): {
  graphData: GraphApiResponse | undefined;
  forceData: ForceApiResponse | undefined;
  projectName: string;
  isLoading: boolean;
  error: Error | undefined;
} {
  const { data: graphData, error: graphError, isLoading: graphLoading } = useSWR<GraphApiResponse>(
    "/api/graph",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const { data: forceData, error: forceError, isLoading: forceLoading } = useSWR<ForceApiResponse>(
    "/api/forces",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const { data: metaData } = useSWR<{ projectName: string }>(
    "/api/meta",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return {
    graphData,
    forceData,
    projectName: metaData?.projectName ?? "Codebase Visualizer",
    isLoading: graphLoading || forceLoading,
    error: graphError ?? forceError,
  };
}
