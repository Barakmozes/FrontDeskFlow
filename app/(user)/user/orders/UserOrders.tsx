"use client";

import {
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineClock,
} from "react-icons/hi2";
import { CiReceipt } from "react-icons/ci";

import Link from "next/link";
import Container from "@/app/components/Common/Container";
import UserDeliveredModal from "./UserDeliveredModal";
import UserOnDeliveryModal from "./UserOnDeliveryModal";
import { Order, User } from "@prisma/client";
import { useQuery } from "@urql/next";
import {
  GetUserDocument,
  GetUserQuery,
  GetUserQueryVariables,
} from "@/graphql/generated";

/**
 * UserOrders.tsx
 * - Displays a user's orders.
 * - If the user is a Waiter/Manager, also displays table-based orders (those with a tableId).
 */

type Props = {
  user: User;
};

export default function UserOrders({ user }: Props) {
  const userEmail = user?.email || "";
  const userRole = user?.role || "";

  // 1) Fetch the user data (which includes orders)
  const [{ data: userData, fetching, error }] = useQuery<
    GetUserQuery,
    GetUserQueryVariables
  >({
    query: GetUserDocument,
    variables: { email: userEmail },
  });

  // 2) If loading or error
  if (fetching) {
    return (
      <Container>
        <div className="mt-6 text-center text-gray-500">Loading orders...</div>
      </Container>
    );
  }
  if (error) {
    console.error("Error fetching user orders:", error);
    return (
      <Container>
        <div className="mt-6 text-center text-red-500">
          Failed to load orders. Please try again.
        </div>
      </Container>
    );
  }

  const orders = userData?.getUser.order || [];

  // 3) Possibly separate table orders from normal delivery orders
  //    if your data model includes a 'tableId' for table-based orders.
  const isStaff = ["WAITER", "MANAGER"].includes(userRole);
  const tableOrders = orders.filter((o) => o.tableId !== null);
  const deliveryOrders = orders.filter((o) => o.tableId === null);

  return (
    <Container>
      {/* Header Section */}
      <div className="mt-6 text-center">
        <h2 className="text-lg md:text-2xl lg:text-3xl leading-tight tracking-tight text-gray-600 sm:text-4xl">
          My Orders
        </h2>
        <Link
          href="/user"
          className="inline-flex items-center justify-center
           bg-green-600 text-lg px-4 py-1 text-white 
           border border-green-500 space-x-2 rounded-full
           hover:text-green-700 hover:bg-green-200"
        >
          <HiOutlineChevronLeft />
          <span>Back to my Profile</span>
        </Link>
      </div>

      {/* 4) If user is staff, show table orders plus normal orders. 
             If not staff, just show normal orders. */}
      {isStaff && tableOrders.length > 0 && (
        <section className="py-12">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            Table Orders (Restaurant)
          </h3>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 
                       lg:grid-cols-3 xl:grid-cols-4 gap-8 max-h-[80vh] 
                       overflow-y-auto scrollbar-hide"
          >
            {tableOrders.map((order) => (
              <OrderCard key={order.id} order={order as Order} />
            ))}
          </div>
        </section>
      )}

      {/* Show normal delivery orders if any */}
      {deliveryOrders.length > 0 && (
        <section className="py-12">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            Delivery Orders
          </h3>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 
                       lg:grid-cols-3 xl:grid-cols-4 gap-8 max-h-[80vh] 
                       overflow-y-auto scrollbar-hide"
          >
            {deliveryOrders.map((order) => (
              <OrderCard key={order.id} order={order as Order} />
            ))}
          </div>
        </section>
      )}

      {/* If user is staff but has no table orders, or user is normal but has no delivery orders */}
      {orders.length < 1 && (
        <div className="text-center text-gray-500">
          <p className="mt-6">No orders found.</p>
        </div>
      )}
    </Container>
  );
}

/**
 * OrderCard
 * Reusable piece to display an order in a small card.
 * Decides which modal (delivered vs on-delivery) to show based on order.status.
 */
function OrderCard({ order }: { order: Order }) {
  return (
    <div className="flex flex-col p-3 border rounded-md space-y-6">
      {order.status === "DELIVERED" ? (
        <UserDeliveredModal order={order} />
      ) : (
        <UserOnDeliveryModal order={order} />
      )}

      <div className="flex justify-between items-center p-1 text-slate-500 bg-slate-100">
        <div className="flex items-center space-x-1">
          <CiReceipt size={28} />
          <div className="flex flex-col text-xs">
            <span>Order</span>
            <span>#{order.orderNumber}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {order.status === "DELIVERED" ? (
            <>
              <HiOutlineCalendarDays size={28} />
              <div className="flex flex-col text-xs">
                <span>Delivered </span>
                <span>May 11 2023</span>
              </div>
            </>
          ) : (
            <>
              <HiOutlineClock size={28} />
              <div className="flex flex-col text-xs">
                <span>Estimated </span>
                <span>16:46 pm</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
