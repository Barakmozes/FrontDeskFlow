"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/store";
import { User } from "@prisma/client";
import { FaCartArrowDown } from "react-icons/fa";
import CartList from "../cart/CartList"; // Or your path to a cart items list component
import { useMutation } from "@urql/next";
import {
  AddOrderToTableDocument, // or your actual GQL doc
  AddOrderToTableMutation,
  AddOrderToTableMutationVariables,
} from "@/graphql/generated"; 
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ORDER_NUMBER } from "@/lib/createOrderNumber";

/**
 * TableCartSummary
 * - Summarizes the user’s cart for an in-restaurant (table) order.
 * - Calls the addOrderToTable GraphQL mutation on "Send Order to Kitchen" or similar action.
 */
type TableCartSummaryProps = {
  user: User; 
};

export default function TableCartSummary({ user }: TableCartSummaryProps) {
  const router = useRouter();

  // 1) Zustand store references
  const { menus, tableId, resetCart ,tableNumber} = useCartStore();
  
  // 2) Local states
  const [orderNumber, setOrderNumber] = useState("");
  const [subTotal, setSubTotal] = useState(0);
  const [note, setNote] = useState("");

  // If you want to keep some fees logic, else remove/adjust:
  const serviceFee = 6;
  const discount = 0; // Possibly no discount
  const total = subTotal + serviceFee - discount;

  // 3) GQL mutation for table order (example name)
  const [_, addTableOrder] = useMutation<
    AddOrderToTableMutation,
    AddOrderToTableMutationVariables
  >(AddOrderToTableDocument);

  // 4) Calculate subtotal & generate orderNumber
  useEffect(() => {
    const newSubTotal = menus.reduce(
      (prev, item) => prev + item.price * item.quantity,
      0
    );
    setSubTotal(newSubTotal);
    setOrderNumber(ORDER_NUMBER); // e.g. "DPS2023..."
  }, [menus]);

  // 5) If no items, show empty cart
  if (menus.length < 1) {
    return (
      <div className="flex items-center justify-center space-x-3">
        <h2 className="text-2xl leading-tight tracking-tight text-gray-600">
          Cart Empty...
        </h2>
        <FaCartArrowDown className="animate-bounce text-green-600" size={24} />
      </div>
    );
  }

  // 6) Finalizing the order for the table
  const handleTableOrder = async () => {
    try {
      // Basic checks (e.g. ensure tableId is set):
      if (!tableId) {
        toast.error("No table selected. Please pick a table first.", {
          duration: 3000,
        });
        return;
      }

      // Prepare the cart data
      const cartItems = menus.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        instructions: item.instructions,
        price: item.price,
        prepare: item.prepare,
      }));

      const response = await addTableOrder({
        tableId,           // which table in the restaurant
        orderNumber,       // generated order number
        cart: cartItems,   // or just pass `menus`
        userName: user.name || "Staff",
        userEmail: user.email || "staff@local",
        serviceFee,
        total,
        note,              // any special instructions or "Send to bar"
        // discount: discount,  // optional
        // paymentToken: ...   // if needed, or skip for table orders
      });

      if (response.error) {
        console.error(response.error);
        toast.error("Could not create table order", { duration: 3000 });
        return;
      }

      // On success, we can reset the cart
      toast.success("Order sent to Kitchen/Bar!", { duration: 3000 });
      resetCart();

      // Optionally navigate or show "Order was successful" screen
      router.push("/user/orders"); 
      // or show a "Your order was created" page
    } catch (error) {
      console.error("Error while creating table order:", error);
      toast.error("An unexpected error occurred.", { duration: 3000 });
    }
  };

  return (
    <div className="border-gray-200 py-4">
      {/* 7) CART LIST */}
      <h2 className="text-center">שולחן מס {tableNumber}</h2>
      <CartList />
      {/* 8) ORDER SUMMARY */}
      <div className="px-4 sm:px-6 lg:px-8 mt-4">
        <h2 className="text-lg leading-6 my-2 font-medium text-gray-900">
          Order Summary 
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Subtotal</dt>
            <dd className="mt-1 text-sm text-gray-900">
              ${subTotal.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Service Fee</dt>
            <dd className="mt-1 text-sm text-gray-900">
              ${serviceFee.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Discount</dt>
            <dd className="mt-1 text-sm text-gray-900">
              -${discount.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total</dt>
            <dd className="mt-1 text-lg font-semibold text-green-700">
              ${total.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      {/* 9) Add a note (optional) */}
      <div className="px-4 sm:px-6 lg:px-8 mt-2">
        <div className="border-t border-gray-200 py-4">
          <h2 className="text-lg leading-6 font-medium text-gray-500">
            Add a Note
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            For special instructions: e.g. “No ice,” “Send to bar,” etc.
          </p>
          <textarea
            id="note"
            name="note"
            rows={2}
            className="w-full mt-2 rounded bg-green-50 border border-green-500
                       focus:border-green-500 focus:outline-none focus-visible:ring-green-500"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* 10) ACTION BUTTON */}
      <div className="px-4 sm:px-6 lg:px-8 mt-2 flex justify-end">
        <button
          onClick={handleTableOrder}
          className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md
                     text-white bg-green-600 hover:bg-green-700 
                     focus:outline-none focus:ring-2 
                     focus:ring-offset-2 focus:ring-green-500"
        >
          Send Order to Kitchen
        </button>
      </div>
    </div>
  );
}
