import { useEffect, useState } from "react";
import { fetchMapSnapshot } from "../services/mapService";
import type { MapSnapshot } from "../types/map";

type MapDataState =
  | { status: "loading" }
  | { status: "ready"; snapshot: MapSnapshot }
  | { status: "error"; message: string };

export function useMapData(): MapDataState {
  const [state, setState] = useState<MapDataState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void fetchMapSnapshot().then(
      snapshot => { if (active) setState({ status: "ready", snapshot }); },
      error => { if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Map statistics are unavailable." }); },
    );
    return () => { active = false; };
  }, []);

  return state;
}
