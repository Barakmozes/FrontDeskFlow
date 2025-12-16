import { Table } from "@prisma/client";
import { useState } from "react";
import { useQuery, useMutation } from "@urql/next";
import {
  GetTablesDocument,
  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,
} from "@/graphql/generated";
import toast from "react-hot-toast";
interface Props {
  table: Table;
}

const ToggleReservation = ({ table }: Props) => {
  const [reserved, setReserved] = useState(table.reserved);

  // GraphQL mutation to update table position in DB
  const [ToggleTableReservationResult, ToggleTableReservationTable] =
    useMutation(ToggleTableReservationDocument);

  // Prepare re-fetch of all tables (so we see immediate update after deletion)
  const [{ data }, reexecuteTables] = useQuery({
    query: GetTablesDocument,
    pause: true,
  });

  const handleToggleReservation = async () => {
    // Save the new toggled value in a local variable
    const newReserved = !reserved;

    // 1) Update the local state
    setReserved(newReserved);
  
    try {
      const result = await ToggleTableReservationTable({
        toggleTableReservationId: table.id,
        reserved: reserved,
      });

      if (result.data) {
        // Show success toast
        toast.success(
          `Table #${result.data.toggleTableReservation.reserved}  successfully!`,
          { duration: 1200 }
        );
        // Re-fetch all tables
        reexecuteTables({ requestPolicy: "network-only" });
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error("Failed to delete table.");
    } finally {
    }
  };

  return (
    <button
      onClick={handleToggleReservation}
      className={` py-1 sm:py-1 text-xs sm:text-sm rounded font-bold ${
        reserved ? "bg-red-200 text-red-700" : "bg-green-200 text-green-700"
      }`}
      aria-label={`Mark table ${table.tableNumber} as ${
        reserved ? "available" : "reserved"
      }`}
    >
      {reserved ? "Release" : "Reserve"}
    </button>
  );
};

export default ToggleReservation;
