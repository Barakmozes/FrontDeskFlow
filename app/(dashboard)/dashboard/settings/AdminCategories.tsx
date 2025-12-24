"use client";

import React from "react";
import { useQuery } from "@urql/next";

import AdminAddCategory from "./AdminAddCategory";
import AdminEditCategory from "./AdminEditCategory";
import AdminDeleteCategory from "./AdminDeleteCategory";

import { GetCategoriesDocument, GetCategoriesQuery } from "@/graphql/generated";

export default function AdminCategories() {
  const [{ data, fetching, error }, reexecute] = useQuery<GetCategoriesQuery>({
    query: GetCategoriesDocument,
    requestPolicy: "cache-first",
  });

  const categories = data?.getCategories ?? [];

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Menu Categories</h2>
          <p className="mt-1 text-sm text-gray-600">
            Used in restaurant + room service menus.
          </p>
        </div>

        <AdminAddCategory
          onChanged={() => reexecute({ requestPolicy: "network-only" })}
        />
      </div>

      <div className="p-5">
        {fetching ? <p className="text-sm text-gray-500">Loading…</p> : null}
        {error ? <p className="text-sm text-red-600">Error: {error.message}</p> : null}

        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">No categories yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Image</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Title</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.img}
                        alt={c.title}
                        className="h-10 w-10 rounded-md border object-cover"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                    <td className="px-4 py-3 text-gray-600">{c.desc}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <AdminEditCategory
                        category={c}
                        onChanged={() => reexecute({ requestPolicy: "network-only" })}
                      />
                      <AdminDeleteCategory
                        category={c}
                        onChanged={() => reexecute({ requestPolicy: "network-only" })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
