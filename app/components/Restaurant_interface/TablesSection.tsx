"use client";

import React, { useRef, useCallback, useEffect } from "react";
import { useDrop } from "react-dnd";
import throttle from "lodash/throttle";
import TableModal from "./TableModal";
import { BasicArea } from "@/graphql/generated";
import{TableInStore}from "@/lib/AreaStore";


export interface TablesSectionProps {
  areaSelect: BasicArea;
  filteredTables:TableInStore[];
  scale: number;
  /**
   * Now expects (tableId: string, newAreaId: string, newPos: { x: number; y: number })
   * for local store updates or anything else.
   */
  moveTable: (tableId: string, newAreaId: string, newPos: { x: number; y: number }) => void;

}

const TablesSection: React.FC<TablesSectionProps> = ({
  areaSelect,
  filteredTables,
  scale,
  moveTable,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);




  
  // Throttle "moveTable"
  const throttledMoveTable = useCallback(
    throttle(async (tableId, newAreaId, newPosition) => {
      // Just do the local store update
      moveTable(tableId, newAreaId, newPosition);
      // No DB call here
    }, 100),
    [moveTable]
  );

  // Snap to 5px grid
  const snapToGrid = (x: number, y: number, gridSize: number) => ({
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  });

  // React DnD
  const [, drop] = useDrop({
    accept: "TABLE",
    drop: (item: { tableId: string }, monitor) => {
      if (!containerRef.current || !areaSelect?.id) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      let x = (offset.x - containerRect.left) / scale;
      let y = (offset.y - containerRect.top) / scale;

      // clamp
      x = Math.max(0, Math.min(x, containerRect.width / scale));
      y = Math.max(0, Math.min(y, containerRect.height / scale));

      const newPosition = snapToGrid(x, y, 5);

      // Call our throttled function with 'id' + newAreaId
      throttledMoveTable(item.tableId, areaSelect.id, newPosition);
    },
  });

  // Cancel throttling on unmount
  useEffect(() => {
    return () => {
      throttledMoveTable.cancel();
    };
  }, [throttledMoveTable]);





  

  return (
    <section
      ref={(el) => {
        drop(el as HTMLDivElement);
        containerRef.current = el as HTMLDivElement;
      }}
      className="relative flex flex-col items-center justify-center px-4 mb-2"
      aria-label={
        areaSelect.name ? `Tables in ${areaSelect.name}` : "All tables"
      }
    >
    <div>
    {areaSelect.name && (
        <div className="flex items-center max-w-2xl mx-auto mb-1  text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mr-2">
            {areaSelect.name}
          </h2>
           
        </div>
      )}
      </div>
      <div
        className="relative w-full h-[100vh] rounded-lg shadow-md break-all mb-6"
        style={{
          backgroundImage: `url(${
             "/img/pexels-pixabay-235985.jpg"
          })`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {filteredTables.map((table) => (
            <TableModal key={table.id} table={table} scale={scale} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(TablesSection);
