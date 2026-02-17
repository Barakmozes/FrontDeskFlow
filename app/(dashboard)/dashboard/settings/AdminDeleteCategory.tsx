"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";
import Modal from "@/app/components/Common/Modal";

import {
  DeleteCategoryDocument,
  DeleteCategoryMutation,
  DeleteCategoryMutationVariables,
  GetCategoriesQuery,
} from "@/graphql/generated";

type Category = GetCategoriesQuery["getCategories"][number];

export default function AdminDeleteCategory({
  category,
  onChanged,
}: {
  category: Category;
  onChanged: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const [{ fetching }, deleteCategory] = useMutation<
    DeleteCategoryMutation,
    DeleteCategoryMutationVariables
  >(DeleteCategoryDocument);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  async function submit() {
    const ok = window.confirm(`Delete category "${category.title}"?`);
    if (!ok) return;

    const res = await deleteCategory({ deleteCategoryId: category.id });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to delete category.");
      return;
    }

    toast.success("Category deleted.");
    onChanged();
    closeModal();
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-md border px-3 py-2 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700"
      >
        Delete
      </button>

      <Modal isOpen={isOpen} title="Delete Category" closeModal={closeModal}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This will delete <span className="font-semibold">{category.title}</span>.  
            You should ensure no menus depend on it.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:bg-gray-300"
              onClick={submit}
              disabled={fetching}
            >
              {fetching ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
