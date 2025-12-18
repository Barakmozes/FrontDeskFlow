"use client";

import React, { useEffect, useState } from "react";
import { useMutation } from "@urql/next";
import toast from "react-hot-toast";

import {
  EditTableDocument,
  EditTableMutation,
  EditTableMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

interface RoomNotesProps {
  room: RoomInStore;
}

/**
 * RoomNotes
 * - Client-side mapping: Table.specialRequests -> Room.notes
 * - Use this as a lightweight replacement for guest requests / housekeeping notes.
 */
const RoomNotes: React.FC<RoomNotesProps> = ({ room }) => {
  const updateRoom = useHotelStore((s) => s.updateRoom);

  const [localNotes, setLocalNotes] = useState<string[]>(room.notes ?? []);
  const [newNote, setNewNote] = useState("");
  const [{ fetching: isSaving }, editTable] = useMutation<
    EditTableMutation,
    EditTableMutationVariables
  >(EditTableDocument);

  // Keep local state in sync when store updates
  useEffect(() => {
    setLocalNotes(room.notes ?? []);
  }, [room.notes]);

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setLocalNotes((prev) => [...prev, trimmed]);
    setNewNote("");
  };

  const handleRemoveNote = (index: number) => {
    setLocalNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveNotes = async () => {
    const result = await editTable({
      editTableId: room.id,
      specialRequests: localNotes,
    });

    if (result.error) {
      console.error("editTable error:", result.error);
      toast.error("Failed to save notes.");
      return;
    }

    updateRoom(room.id, { notes: localNotes });
    toast.success("Notes saved.", { duration: 900 });
  };

  return (
    <div className="mt-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Notes & Requests
      </h3>

      <ul className="mb-2 space-y-1 text-xs sm:text-sm max-h-36 overflow-y-auto">
        {localNotes.map((note, index) => (
          <li
            key={`${index}-${note}`}
            className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
          >
            <span className="flex-1 break-words pr-2">{note}</span>
            <button
              type="button"
              onClick={() => handleRemoveNote(index)}
              className="text-red-500 hover:text-red-700 text-sm"
              aria-label="Remove note"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 px-2 py-2 text-xs sm:text-sm rounded border"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddNote();
            }
          }}
          aria-label="New note"
        />
        <button
          type="button"
          onClick={handleAddNote}
          className="text-sm bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition"
          aria-label="Add note"
        >
          Add
        </button>
      </div>

      <button
        type="button"
        onClick={handleSaveNotes}
        disabled={isSaving}
        className={`mt-2 w-full py-2 text-xs sm:text-sm font-medium rounded ${
          isSaving
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
        aria-label="Save notes"
      >
        {isSaving ? "Saving…" : "Save Notes"}
      </button>
    </div>
  );
};

export default RoomNotes;
