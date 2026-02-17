"use client";

import { useEffect, useMemo, useState } from "react";
import { ReadonlyURLSearchParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiOutlineSearch, HiOutlineUpload } from "react-icons/hi";
import toast from "react-hot-toast";

import OrdersFilter from "../orders/OrdersFilter";
import AdminAddMenu from "../menu/AdminAddMenu";
// import PriceDropDown from "../menu/PriceDropDown";
// import CategoryDropDown from "../menu/CategoryDropDown";

import { useClient } from "urql";
import {
  GetMenusDocument,
  GetOrdersDocument,
  type GetMenusQuery,
  type GetOrdersQuery,
} from "@/graphql/generated";

function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows
    .map((r) => r.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function buildNextUrl(
  pathname: string,
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  patch: Record<string, string | null>
) {
  const next = new URLSearchParams(searchParams.toString());

  for (const [k, v] of Object.entries(patch)) {
    if (!v) next.delete(k);
    else next.set(k, v);
  }

  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

const SearchAndFilter = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urqlClient = useClient();

  // URL-driven search term
  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);

  // keep input in sync when URL changes (back/forward, navigation)
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const placeholder = useMemo(() => {
    if (pathname === "/dashboard/menu") return "Search menu (title / category)…";
    if (pathname === "/dashboard/orders") return "Search orders (order # / customer)…";
    if (pathname === "/dashboard/users") return "Search users (name / email)…";
    if (pathname === "/dashboard/notifications") return "Search notifications…";
    return "Search…";
  }, [pathname]);

  // Debounced URL update (so typing feels smooth)
  useEffect(() => {
    const t = setTimeout(() => {
      const nextUrl = buildNextUrl(pathname, searchParams, { q: q.trim() || null });
      router.replace(nextUrl, { scroll: false });

      // optional: broadcast to listeners
      window.dispatchEvent(
        new CustomEvent("dashboard:search", {
          detail: { pathname, q: q.trim() },
        })
      );
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname]);

  const canExport = pathname === "/dashboard/menu" || pathname === "/dashboard/orders";

  async function exportCurrentPageCsv() {
    if (!canExport) return;

    try {
      toast.loading("Preparing export…", { id: "export" });

      const qLower = (searchParams.get("q") ?? "").trim().toLowerCase();

      if (pathname === "/dashboard/menu") {
        // fetch multiple pages up to safety limit
        let after: string | null = null;
        const all: any[] = [];
        for (let i = 0; i < 20; i++) {
          const res  = await urqlClient
            .query<GetMenusQuery>(GetMenusDocument, { first: 200, after })
            .toPromise();

          if (res.error) throw res.error;

          const conn = res.data?.getMenus as any;
          const edges = (conn?.edges ?? []).filter(Boolean) as any[];

          all.push(...edges.map((e) => e.node));

          if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
          after = conn.pageInfo.endCursor;
        }

        const filtered = qLower
          ? all.filter((m) => {
              const hay = `${m.title} ${m.category} ${m.shortDescr ?? ""} ${m.longDescr ?? ""}`.toLowerCase();
              return hay.includes(qLower);
            })
          : all;

        const rows: unknown[][] = [
          ["id", "title", "category", "price", "sellingPrice", "onPromo"],
          ...filtered.map((m) => [
            m.id,
            m.title,
            m.category,
            m.price,
            m.sellingPrice ?? "",
            m.onPromo ? "true" : "false",
          ]),
        ];

        downloadCsv(`menus_export_${new Date().toISOString().slice(0, 10)}.csv`, rows);
        toast.success(`Exported ${filtered.length} menu items`, { id: "export" });
        return;
      }

      if (pathname === "/dashboard/orders") {
        let after: string | null = null;
        const all: any[] = [];
        for (let i = 0; i < 20; i++) {
          const res = await urqlClient
            .query<GetOrdersQuery>(GetOrdersDocument, { first: 200, after })
            .toPromise();

          if (res.error) throw res.error;

          const conn = res.data?.getOrders as any;
          const edges = (conn?.edges ?? []).filter(Boolean) as any[];
          all.push(...edges.map((e) => e.node));

          if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
          after = conn.pageInfo.endCursor;
        }

        const filtered = qLower
          ? all.filter((o) => {
              const hay = `${o.orderNumber} ${o.userEmail} ${o.userName} ${o.userPhone} ${o.status}`.toLowerCase();
              return hay.includes(qLower);
            })
          : all;

        const rows: unknown[][] = [
          [
            "orderNumber",
            "orderDate",
            "status",
            "paid",
            "total",
            "userEmail",
            "userName",
            "userPhone",
            "deliveryAddress",
          ],
          ...filtered.map((o) => [
            o.orderNumber,
            o.orderDate,
            o.status,
            o.paid ? "true" : "false",
            o.total,
            o.userEmail,
            o.userName,
            o.userPhone,
            o.deliveryAddress,
          ]),
        ];

        downloadCsv(`orders_export_${new Date().toISOString().slice(0, 10)}.csv`, rows);
        toast.success(`Exported ${filtered.length} orders`, { id: "export" });
        return;
      }
    } catch (e: any) {
      console.error("export error:", e);
      toast.error("Export failed.", { id: "export" });
    }
  }

  return (
    <div className="flex flex-col md:flex-row z-10 items-center justify-between space-y-3 md:space-y-0 md:space-x-4 p-4">
      {/* Search */}
      <div className="w-full md:w-1/2">
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            // push immediate update on Enter (debounce already handles typing)
            const nextUrl = buildNextUrl(pathname, searchParams, { q: q.trim() || null });
            router.replace(nextUrl, { scroll: false });
          }}
        >
          <label htmlFor="dashboard-search" className="sr-only">
            Search
          </label>

          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <HiOutlineSearch aria-hidden="true" className="w-5 h-5 text-gray-500" />
            </div>

            <input
              id="dashboard-search"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-600 text-sm rounded-lg block w-full pl-10 p-2"
              placeholder={placeholder}
            />
          </div>
        </form>
      </div>

      {/* Left: actions based on page */}
      <div className="w-full md:w-auto flex flex-col md:flex-row space-y-2 md:space-y-0 items-stretch md:items-center md:space-x-3 flex-shrink-0">
        {pathname === "/dashboard/menu" && (
          <>
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <AdminAddMenu />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <button
                type="button"
                onClick={exportCurrentPageCsv}
                className="text-white inline-flex items-center whitespace-nowrap bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                title="Export menus as CSV"
              >
                <HiOutlineUpload className="mr-1 -ml-1 w-4 h-4" />
                Export
              </button>
            </div>

            {/* <div className="flex items-center space-x-3 w-full md:w-auto">
            <PriceDropDown onChange={(ranges) => console.log("prices:", ranges)} />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
        <CategoryDropDown onChange={(ids) => console.log("categories:", ids)} />

            </div> */}
          </>
        )}

        {pathname === "/dashboard/orders" && (
          <>
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <button
                type="button"
                onClick={exportCurrentPageCsv}
                className="text-white inline-flex items-center whitespace-nowrap bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                title="Export orders as CSV"
              >
                <HiOutlineUpload className="mr-1 -ml-1 w-4 h-4" />
                Export
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right: filters based on page */}
      <div className="w-full md:w-auto flex flex-col md:flex-row space-y-2 md:space-y-0 items-stretch md:items-center justify-end md:space-x-3 flex-shrink-0">
        {pathname === "/dashboard/orders" && (
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <OrdersFilter />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchAndFilter;
