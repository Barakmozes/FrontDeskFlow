import { useMemo, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";

type Props = {
  /** optional: get selected ranges outside */
  onChange?: (selected: string[]) => void;
  /** optional: controlled initial values */
  defaultSelected?: string[];
  /** optional: override ranges */
  ranges?: string[];
};

const PriceDropDown = ({ onChange, defaultSelected = [], ranges }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const priceRange = useMemo(
    () => ranges ?? ["0 - 5", "6 - 10", "11 - 15", "15+"],
    [ranges]
  );

  const [selected, setSelected] = useState<string[]>(defaultSelected);

  const toggle = (value: string) => {
    setSelected((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
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
        Price
        {selected.length > 0 ? (
          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {selected.length}
          </span>
        ) : null}
        <HiChevronDown className="ml-1 mr-1.5 w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute mt-2 -mr-1 w-56 bg-white rounded-md shadow-lg z-10">
          <div className="text-center py-3">
            <h3>Filter by Price</h3>
          </div>

          <ul className="space-y-2 text-sm p-3">
            {priceRange.map((range) => {
              const id = `price-${range.replace(/\s+/g, "").replace("+", "plus")}`;
              const checked = selected.includes(range);

              return (
                <li className="flex items-center" key={range}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(range)}
                    className="w-4 h-4 accent-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                  />

                  <label htmlFor={id} className="ml-2 text-sm font-medium text-gray-600">
                    ${range}
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

export default PriceDropDown;
