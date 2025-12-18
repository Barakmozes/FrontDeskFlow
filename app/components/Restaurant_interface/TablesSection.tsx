"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import throttle from "lodash/throttle";

import type { BasicArea } from "@/graphql/generated";
import type { RoomInStore } from "@/lib/AreaStore";

import RoomPin from "./TableModal";

export interface RoomsSectionProps {
  /** Selected hotel (backend: Area) */
  hotel: BasicArea;
  /** Rooms within the selected hotel (backend: Tables filtered by areaId) */
  rooms: RoomInStore[];
  /** Current zoom scale */
  scale: number;
  /**
   * Updates room position in client store (persisted later by bulk save).
   * newHotelId is kept for parity with the backend model (areaId).
   */
  moveRoom: (
    roomId: string,
    newHotelId: string,
    newPosition: { x: number; y: number }
  ) => void;
}

const snapToGrid = (x: number, y: number, gridSize: number) => ({
  x: Math.round(x / gridSize) * gridSize,
  y: Math.round(y / gridSize) * gridSize,
});

const RoomsSection: React.FC<RoomsSectionProps> = ({
  hotel,
  rooms,
  scale,
  moveRoom,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Throttle drag updates to keep UI smooth
  const throttledMoveRoom = useCallback(
    throttle(
      (
        roomId: string,
        newHotelId: string,
        newPosition: { x: number; y: number }
      ) => {
        moveRoom(roomId, newHotelId, newPosition);
      },
      80,
      { trailing: true }
    ),
    [moveRoom]
  );

  const [, drop] = useDrop({
    accept: "ROOM",
    drop: (item: { roomId: string }, monitor) => {
      if (!containerRef.current) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      // Convert from screen coords -> scaled floorplan coords
      let x = (offset.x - containerRect.left) / scale;
      let y = (offset.y - containerRect.top) / scale;

      // Clamp within bounds
      x = Math.max(0, Math.min(x, containerRect.width / scale));
      y = Math.max(0, Math.min(y, containerRect.height / scale));

      const newPosition = snapToGrid(x, y, 5);
      throttledMoveRoom(item.roomId, hotel.id, newPosition);
    },
  });

  useEffect(() => {
    return () => throttledMoveRoom.cancel();
  }, [throttledMoveRoom]);

  const backgroundImage =
    hotel.floorPlanImage && hotel.floorPlanImage.trim().length > 0
      ? hotel.floorPlanImage
      : "/img/pexels-pixabay-235985.jpg";

  return (
    <section
      ref={(el) => {
        drop(el as HTMLDivElement);
        containerRef.current = el as HTMLDivElement;
      }}
      className="relative flex flex-col items-center justify-center px-4 mb-4"
      aria-label={hotel.name ? `Rooms in ${hotel.name}` : "Rooms"}
    >
      <div className="flex items-center max-w-3xl w-full mx-auto mb-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
          {hotel.name}
        </h2>
        <span className="ml-3 text-sm text-gray-500">
          Drag rooms to reposition.
        </span>
      </div>

      <div
        className="relative w-full h-[85vh] rounded-lg shadow-md border bg-white overflow-hidden"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Scale layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {rooms.map((room) => (
            <RoomPin key={room.id} room={room} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(RoomsSection);
