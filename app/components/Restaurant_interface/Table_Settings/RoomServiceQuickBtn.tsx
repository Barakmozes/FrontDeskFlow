import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";

export function RoomServiceQuickBtn({ roomId, roomNumber }: { roomId: string; roomNumber: number }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        useCartStore.getState().startOrderForTable(roomId, roomNumber);
        router.push("/dashboard/room-service");
      }}
      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
    >
      Room Service
    </button>
  );
}
