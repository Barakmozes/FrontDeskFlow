export type FolioLine = {
  id: string; // unique for UI
  kind: "CHARGE" | "PAYMENT";
  source: "ROOM_SERVICE" | "MANUAL";
  date: string; // ISO
  description: string;
  amount: number; // positive
  deletable?: boolean; // only manual entries
};
