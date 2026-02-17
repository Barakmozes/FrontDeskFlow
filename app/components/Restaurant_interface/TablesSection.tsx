"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useDrop, type DropTargetMonitor } from "react-dnd";
import throttle from "lodash/throttle";

import type { BasicArea } from "@/graphql/generated";
import type { RoomInStore } from "@/lib/AreaStore";

import RoomPin from "./TableModal";

export interface RoomsSectionProps {
  hotel: BasicArea;
  rooms: RoomInStore[];
  scale: number;
  moveRoom: (
    roomId: string,
    newHotelId: string,
    newPosition: { x: number; y: number }
  ) => void;
}

type DragItem = {
  roomId: string;
  left: number;
  top: number;
};

// אם תרצה Snap עדין בעתיד – שים מספר > 0 (למשל 5)
// לבקשה שלך ("בלי סטייה") נשאיר 0
const GRID_SIZE = 0;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const snapIfNeeded = (x: number, y: number) => {
  if (GRID_SIZE <= 0) return { x, y };
  return {
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
  };
};

const RoomsSection: React.FC<RoomsSectionProps> = ({ hotel, rooms, scale, moveRoom }) => {
  const floorplanRef = useRef<HTMLDivElement | null>(null);

  // "Preview move" בזמן גרירה (נעים וחלק)
  // 16ms ~ פריים אחד (60fps)
  const throttledPreviewMove = useMemo(
    () =>
      throttle((roomId: string, pos: { x: number; y: number }) => {
        moveRoom(roomId, hotel.id, pos);
      }, 16),
    [moveRoom, hotel.id]
  );

  useEffect(() => {
    return () => throttledPreviewMove.cancel();
  }, [throttledPreviewMove]);

  const computeNextPosition = useCallback(
    (item: DragItem, monitor: DropTargetMonitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (!delta) return null;

      // תזוזה לפי דלתא => אין סטייה של "איפה תפסת" / כותרות / פדינג
      let x = item.left + delta.x / scale;
      let y = item.top + delta.y / scale;

      // Snap אופציונלי (כבוי כרגע)
      ({ x, y } = snapIfNeeded(x, y));

      // Clamp לגבולות ה־floorplan (ביחידות לא-מוגדלות)
      const el = floorplanRef.current;
      if (el) {
        const maxX = el.clientWidth / scale;
        const maxY = el.clientHeight / scale;
        x = clamp(x, 0, maxX);
        y = clamp(y, 0, maxY);
      }

      return { x, y };
    },
    [scale]
  );

  const [, drop] = useDrop<DragItem>({
    accept: "ROOM",

    // בזמן גרירה: להזיז את החדר live (נעים)
    hover: (item, monitor) => {
      if (!monitor.isOver({ shallow: true })) return;

      const next = computeNextPosition(item, monitor);
      if (!next) return;

      throttledPreviewMove(item.roomId, next);
    },

    // בשחרור: לשים מיקום סופי מדויק (בלי Throttle כדי לא לפספס את ה"פיקסל האחרון")
    drop: (item, monitor) => {
      throttledPreviewMove.cancel();

      const next = computeNextPosition(item, monitor);
      if (!next) return;

      moveRoom(item.roomId, hotel.id, next);
    },
  });

  const backgroundImage =
    hotel.floorPlanImage && hotel.floorPlanImage.trim().length > 0
      ? hotel.floorPlanImage
      : "/img/pexels-pixabay-235985.jpg";

  return (
    <section
      className="relative flex flex-col items-center justify-center px-4 mb-4 bg-rose-50"
      aria-label={hotel.name ? `Rooms in ${hotel.name}` : "Rooms"}
    >
      <div className="flex items-center max-w-3xl w-full mx-auto mb-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{hotel.name}</h2>
        <span className="ml-3 text-sm text-gray-500">Drag rooms to reposition.</span>
      </div>

      {/* ✅ את ה-drop מחברים לכאן (ה־floorplan), לא ל־section */}
      <div
        ref={(el) => {
          floorplanRef.current = el;
          drop(el);
        }}
        className="relative w-4/6 h-[85vh] rounded-lg shadow-md border bg-white overflow-hidden"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "70% 50%",
          backgroundRepeat: "no-repeat",
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
