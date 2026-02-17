
import SearchAndFilter from "./SearchAndFilter";

type TableProps = {
  title: string;
  children: React.ReactNode;
    showSearchAndFilter?: boolean;
};

const TableWrapper = ({ title, children,showSearchAndFilter = true }: TableProps) => {
  return (
    <div className="rounded-lg shadow-2xl p-6 my-12 max-h-[80vh] overflow-y-auto bg-white">
      <div>
        <h2 className="text-center  mb-6 text-2xl font-semibold text-slate-500">
          {title}
        </h2>
      {showSearchAndFilter ? <SearchAndFilter /> : null}
      </div>

      <div className="relative overflow-x-auto  ">{children}</div>
    </div>
  );
};

export default TableWrapper;