"use client";

import { useState } from "react";
import Modal from "@/app/components/Common/Modal";
import { HiPlus } from "react-icons/hi2";
import CreateUserForm from "./CreateUserForm";

type Props = {
  onCreated: () => void;
};

export default function CreateUserModal({ onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  function openModal() {
    setIsOpen(true);
  }
  function closeModal() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
      >
        <HiPlus className="h-5 w-5" />
        Add User
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title="Add New User">
        <CreateUserForm
          onCancel={closeModal}
          onSuccess={() => {
            onCreated();
            closeModal();
          }}
        />
      </Modal>
    </>
  );
}
