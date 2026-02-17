"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";

import Modal from "@/app/components/Common/Modal";
import UploadImg from "../Components/UploadImg";
import { SupabaseImageUpload } from "@/lib/supabaseStorage";

import {
  EditCategoryDocument,
  EditCategoryMutation,
  EditCategoryMutationVariables,
  GetCategoriesQuery,
} from "@/graphql/generated";

type Category = GetCategoriesQuery["getCategories"][number];

export default function AdminEditCategory({
  category,
  onChanged,
}: {
  category: Category;
  onChanged: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const [{ fetching }, editCategory] = useMutation<
    EditCategoryMutation,
    EditCategoryMutationVariables
  >(EditCategoryDocument);

  const [title, setTitle] = useState(category.title);
  const [desc, setDesc] = useState(category.desc);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState(category.img);

  useEffect(() => {
    setTitle(category.title);
    setDesc(category.desc);
    setImgUrl(category.img);
    setImgFile(null);
  }, [category.id]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  async function submit() {
    if (!title.trim()) return toast.error("Title is required.");
    if (!desc.trim()) return toast.error("Description is required.");

    let nextImg = imgUrl;

    if (imgFile) {
      const url = await SupabaseImageUpload(imgFile);
      if (!url) return toast.error("Image upload failed.");
      nextImg = url;
    }

    const res = await editCategory({
      editCategoryId: category.id,
      title: title.trim(),
      desc: desc.trim(),
      img: nextImg,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to update category.");
      return;
    }

    toast.success("Category updated.");
    onChanged();
    closeModal();
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
      >
        Edit
      </button>

      <Modal isOpen={isOpen} title="Edit Category" closeModal={closeModal}>
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
              <UploadImg handleCallBack={(f: File) => setImgFile(f)} id="cat-edit-img" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="category" className="mt-3 h-20 w-20 rounded-md border object-cover" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50" onClick={closeModal}>
              Cancel
            </button>
            <button className="form-button" onClick={submit} disabled={fetching}>
              {fetching ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
