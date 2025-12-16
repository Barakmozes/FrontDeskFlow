"use client";

import React, { useState } from "react";
import { FaEdit } from "react-icons/fa";
import Modal from "../../Common/Modal";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
    Area,
  GetAreasNameDescriptionDocument,
  EditAreaDocument,
  EditAreaMutation,
  EditAreaMutationVariables,
} from "@/graphql/generated";

// The SupabaseImageUpload function is assumed to be imported from your storage logic
import { SupabaseImageUpload } from "@/lib/supabaseStorage";
// The UploadImg component you mentioned
import UploadImg from "../../../(dashboard)/dashboard/Components/UploadImg";
import Image from "next/image";

type Props = {
  /** All available areas, if you want to populate a dropdown */
  areas: Area[];
  /** An initial area to edit, if you already know which one is selected */
  areaSelectToEdit?: Area;
};

const EditZoneModal = ({ areas, areaSelectToEdit }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  // 1) State for selecting which area we're editing
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // 2) Fields for editing area data
  const [zoneName, setZoneName] = useState("");
  const [zoneDesc, setZoneDesc] = useState("");
  const [zoneImage, setZoneImage] = useState("");

  // GraphQL: re-fetch areas so updated info appears immediately
  const [{}, reexecuteQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: {
        orderBy: { createdAt: "asc" },
      }, // We'll call reexecuteQuery manually on success
  });
  

  // GraphQL: editArea mutation
  const [{ fetching: updating }, editArea] = useMutation<
    EditAreaMutation,
    EditAreaMutationVariables
  >(EditAreaDocument);


  // ---------------------------
  // OPEN/CLOSE MODAL
  // ---------------------------
  const openModal = () => {
    // If we already have a selected area from props, use that;
    // else pick the first from areas[] if it exists:
    const initialId =
      areaSelectToEdit?.id ||
      (areas.length > 0 ? areas[0].id : "");

    setSelectedAreaId(initialId);
    // Pre-fill fields if we have an existing area
    if (areaSelectToEdit) {
      setZoneName(areaSelectToEdit.name || "");
      setZoneDesc(areaSelectToEdit.description || "");
      setZoneImage(areaSelectToEdit.floorPlanImage || "");
    } else if (areas.length > 0) {
      setZoneName(areas[0].name || "");
      setZoneDesc(areas[0].description || "");
      setZoneImage(areas[0].floorPlanImage || "");
    }

    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    // Optional: Reset fields
    setSelectedAreaId("");
    setZoneName("");
    setZoneDesc("");
    setZoneImage("");
  };

  // ---------------------------
  // HANDLE DROPDOWN CHANGE
  // ---------------------------
  // If you want the user to be able to switch areas within the modal:
  const handleSelectArea = (id: string) => {
    setSelectedAreaId(id);
    const found = areas.find((a) => a.id === id);
    if (found) {
      setZoneName(found.name || "");
      setZoneDesc(found.description || "");
      setZoneImage(found.floorPlanImage || "");
    } else {
      setZoneName("");
      setZoneDesc("");
      setZoneImage("");
    }
  };

  // ---------------------------
  // IMAGE UPLOAD HANDLER
  // ---------------------------
  const getMenuImageFile = async (file: File) => {
    try {
      const res = await SupabaseImageUpload(file);
      if (res) {
        setZoneImage(res);
        toast.success("Floor plan image uploaded!");
        console.log(res);
      }
    } catch (error) {
      toast.error(`Error uploading image: ${error}`, { duration: 3000 });
    }
  };

  // ---------------------------
  // SUBMIT EDIT
  // ---------------------------
  const handleUpdateArea = async () => {
    if (!selectedAreaId) return;

    try {
      const result = await editArea({
        editAreaId: selectedAreaId,
        name: zoneName || undefined,
        description: zoneDesc || undefined,
        floorPlanImage: zoneImage || undefined,
      });

      if (result.data?.editArea?.id) {
        toast.success("Area updated successfully!", { duration: 1200 });
        // Re-fetch the list of areas to see the changes
        reexecuteQuery({ requestPolicy: "network-only" });
        closeModal();
      }
    } catch (error) {
      console.error("Error editing area:", error);
      toast.error("Failed to update area.");
    }
  };



  return (
    <>
      {/* 
        TRIGGER TO OPEN MODAL
        Could be an icon + text. 
      */}
      
      <div
        onClick={openModal}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition"
      >
        <FaEdit className="h-5 w-5" aria-hidden="true"
      />
        <span className="text-sm font-medium">Edit Area</span>
      </div>

      {/* 
        EDIT ZONE MODAL
      */}
      <Modal isOpen={isOpen} closeModal={closeModal}>
        <div className="relative p-4 w-full max-w-md md:h-auto mx-auto bg-white rounded-lg shadow">
          {/* Title & Icon */}
          <div className="text-center">
            <FaEdit
              className="text-gray-500 w-10 h-10 mb-2 mx-auto"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Edit Zone
            </h2>
          </div>

          {/* CONTENT */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateArea();
            }}
            className="flex flex-col gap-4"
          >
            {/* (Optional) Select which area to edit */}
            {areas.length > 0 && (
              <div>
                <label
                  htmlFor="areaSelect"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Zone
                </label>
                <select
                  id="areaSelect"
                  value={selectedAreaId}
                  onChange={(e) => handleSelectArea(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
                >
                  <option value="">-- Choose an area --</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label
                htmlFor="zoneName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Zone Name
              </label>
              <input
                id="zoneName"
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Zone name"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="zoneDesc"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="zoneDesc"
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              />
            </div>

            {/* Floor Plan Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Floor Plan Image
              </label>
              {/* Show current image thumbnail if available */}
              {zoneImage && (
                <div className="mb-2">
                  <Image
                    src={zoneImage}
                    alt="Floor Plan Preview"
                    className="w-full h-auto max-h-48 object-contain border rounded"
                  />

                </div>


              )}

              {/* Upload input */}
              <UploadImg handleCallBack={getMenuImageFile} id="editZoneFloorPlan" />
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-200 
                  rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedAreaId || updating}
                className="py-2 px-4 text-sm font-medium text-white bg-blue-600 
                  rounded hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                {updating ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
};

export default EditZoneModal;
