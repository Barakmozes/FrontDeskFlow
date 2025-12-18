"use client";

import Modal from "@/app/components/Common/Modal";
import { useState } from "react";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import EditRoleForm from "./EditRoleForm";
import type { UserRow } from "./types";

type Props = {
  user: UserRow;
  onUpdated: () => void;
};

export default function EditRoleModal({ user, onUpdated }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <>
      <HiOutlinePencilSquare onClick={openModal} className="cursor-pointer h-6 w-6" />
      <Modal isOpen={isOpen} closeModal={closeModal} title="Edit Role">
        <EditRoleForm
          user={user}
          onClose={closeModal}
          onUpdated={onUpdated}
        />
      </Modal>
    </>
  );
}
