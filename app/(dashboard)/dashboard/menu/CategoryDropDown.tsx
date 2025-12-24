import { useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { categoriesData } from "@/data/categories-data";

type Props = {
  /** optional: get selected categories outside */
  onChange?: (selectedIds: string[]) => void;
  /** optional: controlled initial values */
  defaultSelected?: string[];
};

const CategoryDropDown = ({ onChange, defaultSelected = [] }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelected);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      onChange?.(next);
      return next;
    });
  };

  return (
    <div className="relative inline-block bg-white hover:block cursor-pointer">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="md:w-auto flex items-center justify-center py-2 px-4 text-sm text-gray-900 focus:outline-none bg-white border-b-2 border-gray-400 hover:bg-gray-100 hover:text-green-700"
      >
        Category
        {selectedIds.length > 0 ? (
          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {selectedIds.length}
          </span>
        ) : null}
        <HiChevronDown className="ml-1 mr-1.5 w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute mt-2 -mr-1 w-56 bg-white rounded-md shadow-lg z-10">
          <div className="text-center py-3">
            <h3>Filter by Category</h3>
          </div>

          <ul className="space-y-2 text-sm p-3">
            {categoriesData.map((cat) => {
              const checked = selectedIds.includes(cat.id);
              const id = `cat-${cat.id}`;

              return (
                <li className="flex items-center" key={cat.id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(cat.id)}
                    className="w-4 h-4 accent-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                  />

                  <label htmlFor={id} className="ml-2 text-sm font-medium text-gray-600">
                    {cat.title}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CategoryDropDown;
