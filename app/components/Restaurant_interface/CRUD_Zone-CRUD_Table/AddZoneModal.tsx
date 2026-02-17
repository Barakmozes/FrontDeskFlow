"use client";

import React from "react";
import { HiPlus } from "react-icons/hi2";

interface AddHotelButtonProps {
  openModal: () => void;
}

/**
 * AddHotelButton (trigger)
 */
const AddHotelButton: React.FC<AddHotelButtonProps> = ({ openModal }) => {
  return (
    <button
      type="button"
      onClick={openModal}
      className="flex items-center gap-2 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 transition"
      aria-label="Add hotel"
    >
      <HiPlus className="h-4 w-4" />
      Add Hotel
    </button>
  );
};

export default AddHotelButton;
