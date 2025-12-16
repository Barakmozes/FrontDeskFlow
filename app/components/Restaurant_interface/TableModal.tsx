"use client";

import React from "react";
import { useDrag } from "react-dnd";

import EditTableModal from "./CRUD_Zone-CRUD_Table/EditTableModal";
import DeleteTableModal from "./CRUD_Zone-CRUD_Table/DeleteTableModal";
import { TableInStore } from "@/lib/AreaStore";
import ToggleReservation from "./Table_Settings/ToggleReservation";
import SpecialRequests from "./Table_Settings/specialRequests";
import TableReservations from "./Table_Settings/TableReservations";
import Start_an_order from "./Table_Settings/Start_an_order_Table";

export interface TableModalProps {
  table: TableInStore;
  scale: number;
}

const TableModal: React.FC<TableModalProps> = ({ table, scale }) => {

  const isDirty = table?.dirty;

  const { tableNumber, diners, position, id, reserved } = table;
  const x = (position as any)?.x ?? 0;
  const y = (position as any)?.y ?? 0;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "TABLE",
    item: { tableId: table.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));



  return (
    <div
      ref={drag}
      className={`relative p-2 sm:p-2 bg-white rounded-lg shadow-md border border-gray-200 transition-transform ${
        isDragging ? "opacity-75 border-blue-500" : ""
      }`}
      style={{
        position: "absolute",
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: "top left",
        width: "clamp(120px, 20vw, 160px)", // Responsive width
        cursor: "move",
      }}
      aria-label={`Table ${tableNumber}, ${
        reserved ? "Reserved" : "Available"
      }, for ${diners} diners`}
    >
      {/* Table Info */}
      <div className="mb-2 text-start">
        <div className="flex mx-auto justify-between mb-1">
          <div
            className="text-sm bg-green-600 text-white px-2 py-1 rounded-lg shadow hover:bg-green-700 transition"
            aria-label="Show All Tables"
          >
            <DeleteTableModal table={table as TableInStore} />
          </div>
          <div
            className="text-sm bg-green-600 text-white px-2 py-1 rounded-lg shadow hover:bg-green-700 transition"
            aria-label="Show All Tables"
          >
            <EditTableModal table={table as TableInStore} />
          </div>
        </div>
        <h2 className="text-sm sm:text-base font-bold text-gray-700">
          Table #{tableNumber}
          {isDirty && <span className="text-red-500">*</span>}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">
          <strong>Diners:</strong> {diners}
        </p>
        
        <div className="flex">
          {/* Reservation Toggle */}
        <ToggleReservation table={table as TableInStore} />
             {/* Table Reservations */}
        <TableReservations table={table as TableInStore} />
        </div>
      
      </div>

      
      {/* Special Requests */}
         <SpecialRequests table={table as TableInStore  /* if needed, or typed to the same shape */} />

              
         <Start_an_order table={table as TableInStore}/>
      {/* Table Visualization */}
      <div className="relative mt-4 mx-auto">
        <div
          className={`relative ${
            diners <= 4
              ? "w-20 h-20 sm:w-24 sm:h-24 rounded-full"
              : "w-32 h-20 sm:w-36 sm:h-24 rounded-lg"
          } bg-gray-200 shadow-inner flex items-center justify-center`}
        >
          <h3 className="absolute text-xs sm:text-sm font-bold text-gray-600">
            #{tableNumber}
          </h3>
          {Array.from({ length: diners }).map((_, index) => {
            const angle = (index / diners) * 360;
            const radius = diners <= 4 ? 35 : 45; // Adjust radius for smaller screens
            const seatX = radius * Math.cos((angle * Math.PI) / 180);
            const seatY = radius * Math.sin((angle * Math.PI) / 180);
            return (
              <div
                key={index}
                className="absolute w-4 h-4 sm:w-5 sm:h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold"
                style={{
                  transform: `translate(${seatX}px, ${seatY}px)`,
                }}
                aria-label={`Seat ${index + 1}`}
              >
                {index + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TableModal);
