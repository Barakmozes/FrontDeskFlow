"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";

import Modal from "../Common/Modal";
import type { RoomInStore } from "@/lib/AreaStore";

import ToggleOccupancy from "./Table_Settings/ToggleReservation";
import RoomBookings from "./Table_Settings/TableReservations";
import RoomNotes from "./Table_Settings/specialRequests";
import EditRoomModal from "./CRUD_Zone-CRUD_Table/EditTableModal";
import DeleteRoomModal from "./CRUD_Zone-CRUD_Table/DeleteTableModal";

interface RoomPinProps {
  room: RoomInStore;
}

type DragItem = {
  roomId: string;
  left: number;
  top: number;
};

const RoomPin: React.FC<RoomPinProps> = ({ room }) => {
  const [isOpen, setIsOpen] = useState(false);

  const x = room.position?.x ?? 0;
  const y = room.position?.y ?? 0;

  const statusLabel = room.isOccupied ? "Occupied" : "Available";
  const statusClass = room.isOccupied
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-green-100 text-green-700 border-green-200";

  const title = useMemo(() => `Room ${room.roomNumber}`, [room.roomNumber]);

  const [{ isDragging }, dragRef, preview] = useDrag(
    () => ({
      type: "ROOM",
      // ✅ שולחים גם את המיקום ההתחלתי
      item: (): DragItem => ({ roomId: room.id, left: x, top: y }),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [room.id, x, y]
  );

  // ✅ אופציונלי אבל מומלץ: מבטל את תמונת ה-ghost של הדפדפן,
  // ואז אתה רואה את השולחן עצמו זז בצורה הכי "נעימה"
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <>
      <div
        ref={dragRef}
        className={`absolute select-none ${isDragging ? "opacity-60" : "opacity-100"}`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          transformOrigin: "top left",
          zIndex: isDragging ? 50 : 10,
        }}
        aria-label={`${title} (${statusLabel})`}
      >
        <button
          type="button"
          onClick={() => {
            // נשאיר כמו אצלך – בפועל לרוב drag לא יורה click
            if (!isDragging) setIsOpen(true);
          }}
          className={`flex items-center gap-2 px-2 py-1 rounded-lg border shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing ${statusClass}`}
        >
          <span className="text-xs font-semibold">{room.roomNumber}</span>
          {room.dirty ? <span className="text-[10px] font-semibold text-orange-700">●</span> : null}
        </button>
      </div>

      <Modal isOpen={isOpen} closeModal={() => setIsOpen(false)} title={`${title} — ${statusLabel}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-semibold">Max guests:</span> {room.capacity}
              </div>
              <div className="text-xs text-gray-500">Hotel ID: {room.hotelId}</div>
            </div>

            <div className="flex items-center gap-2">
              <EditRoomModal room={room} />
              <DeleteRoomModal room={room} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ToggleOccupancy room={room}  />
            <RoomBookings room={room} />
          </div>

          <RoomNotes room={room} />
        </div>
      </Modal>
    </>
  );
};

export default React.memo(RoomPin);
