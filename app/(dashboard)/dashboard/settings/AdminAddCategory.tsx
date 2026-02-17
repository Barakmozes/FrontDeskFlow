"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";

import Modal from "@/app/components/Common/Modal";
import UploadImg from "../Components/UploadImg";
import { SupabaseImageUpload } from "@/lib/supabaseStorage";

import {
  AddCategoryDocument,
  AddCategoryMutation,
  AddCategoryMutationVariables,
} from "@/graphql/generated";

export default function AdminAddCategory({ onChanged }: { onChanged: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const [{ fetching }, addCategory] = useMutation<AddCategoryMutation, AddCategoryMutationVariables>(
    AddCategoryDocument
  );

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    setTitle("");
    setDesc("");
    setImgFile(null);
  };

  async function submit() {
    if (!title.trim()) return toast.error("Title is required.");
    if (!desc.trim()) return toast.error("Description is required.");
    if (!imgFile) return toast.error("Image is required.");

    const url = await SupabaseImageUpload(imgFile);
    if (!url) return toast.error("Image upload failed.");

    const res = await addCategory({
      title: title.trim(),
      desc: desc.trim(),
      img: url,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to create category.");
      return;
    }

    toast.success("Category created.");
    onChanged();
    closeModal();
  }

  return (
    <>
      <button onClick={openModal} className="form-button">
        Add Category
      </button>

      <Modal isOpen={isOpen} title="Add Category" closeModal={closeModal}>
        <div className="space-y-4">
          <div>
            <label className="form-label">Title</label>
            <input className="formInput" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Description</label>
            <input className="formInput" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Image</label>
            <div className="rounded-md border bg-gray-50 p-3">
              <UploadImg handleCallBack={(f: File) => setImgFile(f)} id="cat-img" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50" onClick={closeModal}>
              Cancel
            </button>
            <button className="form-button" onClick={submit} disabled={fetching}>
              {fetching ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
