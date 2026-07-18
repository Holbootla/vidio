import { create } from "zustand";
import type { ProcessedSource } from "@/lib/player/source-selection";

interface PlayerUiState {
  selectedSourceId: string | null;
  textTrackId: string | null;
  showKeyboardHelp: boolean;
  setSelectedSource: (source: ProcessedSource | null) => void;
  setTextTrackId: (trackId: string | null) => void;
  setShowKeyboardHelp: (show: boolean) => void;
  reset: () => void;
}

const initialState = {
  selectedSourceId: null as string | null,
  textTrackId: null as string | null,
  showKeyboardHelp: false,
};

export const usePlayerStore = create<PlayerUiState>((set) => ({
  ...initialState,
  setSelectedSource: (source) => set({ selectedSourceId: source?.id ?? null }),
  setTextTrackId: (trackId) => set({ textTrackId: trackId }),
  setShowKeyboardHelp: (show) => set({ showKeyboardHelp: show }),
  reset: () => set(initialState),
}));
