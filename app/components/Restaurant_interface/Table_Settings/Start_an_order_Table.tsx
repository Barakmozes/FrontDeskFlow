// app\components\Restaurant_interface\Table_Settings\Start_an_order_Table.tsx

"use client";

import React from "react";
import { useRouter } from "next/navigation"; // Next.js14 App Router
import { useCartStore } from "@/lib/store";  // Adjust the import path as needed
import { Table } from "@prisma/client";      // Adjust if you have a local Table type


interface StartAnOrderProps {
  table: Table;
}

const StartAnOrder = ({ table }: StartAnOrderProps) => {
  const router = useRouter();

  // Using selector functions to subscribe only to the actions we need
  const setTableId = useCartStore((state) => state.setTableId);
  const resetCart = useCartStore((state) => state.resetCart);
  const setTableNumber = useCartStore((state) => state.setTableNumber);
  const handleStartOrder = () => {
    // 1) Clear or reset cart if you do NOT want leftover items
    resetCart();

    // 2) Set the new table ID in our cart store (for table-based ordering)
    setTableId(table.id);
    setTableNumber(table.tableNumber);
    // 3) Navigate (or “scroll”) to #menuSection on the same page,
    //    so the waiter/manager sees the existing Menu and can add items.
    router.replace("/#menuSection");
  };

  return (
   
    <button
       onClick={handleStartOrder}
      type="button"
      className="w-full py-3 px-4 mt-2 text-base font-medium text-black bg-orange-400
                 rounded hover:bg-orange-500 transition disabled:bg-gray-400"
    >
      Start an order
    </button>
    
  );
};

export default StartAnOrder;
