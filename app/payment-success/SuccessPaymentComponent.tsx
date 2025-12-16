'use client';

import {
  AddOrderDocument,
  AddOrderMutation,
  AddOrderMutationVariables,
  EditOrderOnPaymentDocument,
  EditOrderOnPaymentMutation,
  EditOrderOnPaymentMutationVariables,
} from "@/graphql/generated";

import { useCartStore } from "@/lib/store";
import { useMutation } from "@urql/next";
import { useRouter, useSearchParams } from "next/navigation";
import { AiOutlineCheck } from "react-icons/ai";
import ConfettiExplosion from "react-confetti-explosion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";



const SuccessPaymentComponent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentToken = searchParams.get("page_request_uid");
  const transactionUid = searchParams.get("transaction_uid");
  const status = searchParams.get("status");
  const orderId = searchParams.get("orderId");

  const { resetCart } = useCartStore();
  const [loading, setLoading] = useState(false);

  const [_, addOrder] = useMutation<AddOrderMutation, AddOrderMutationVariables>(
    AddOrderDocument
  );

  const [_a, editPaidOrder] = useMutation<EditOrderOnPaymentMutation, EditOrderOnPaymentMutationVariables>(
    EditOrderOnPaymentDocument
  );

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      if (!orderId || !paymentToken || !transactionUid || !status) {
        toast.error("Invalid payment details. Unable to process the order.", { duration: 800 });
        console.error("Missing required parameters:", {
          orderId,
          paymentToken,
          transactionUid,
          status,
        });
        return;
      }

      if (status !== "approved") {
        toast.error("Payment was not successful. Please contact support.", { duration: 800 });
        console.error("Transaction failed with status:", status);
        return;
      }

      try {
        setLoading(true);

        // Retrieve order details from localStorage
        const orderDetails = JSON.parse(localStorage.getItem("You&i_cart") || "{}");

        if (!orderDetails.cart || orderDetails.cart.length === 0) {
          throw new Error("Order details are missing or invalid.");
        }

        // console.log("Adding order with details:", orderDetails);

        // Add the order to the database
        const addOrderRes = await addOrder({
          cart: orderDetails.cart,
          deliveryAddress: orderDetails.deliveryAddress,
          deliveryFee: orderDetails.deliveryFee,
          userEmail: orderDetails.userEmail,
          userName: orderDetails.userName,
          userPhone: orderDetails.userPhone,
          orderNumber: orderDetails.orderNumber,
          serviceFee: orderDetails.serviceFee,
          total: orderDetails.total,
          discount: orderDetails.discount,
          note: orderDetails.note,
        });

        
// console.log("Added order", addOrderRes.data?.addOrder);
  // Update the payment status and token
        if (addOrderRes.data?.addOrder) {
          const editOrderRes = await editPaidOrder({
            editOrderOnPaymentId:addOrderRes.data.addOrder.id,// Use the ID from the created order
            paymentToken: paymentToken,
          });
          if (!editOrderRes.data?.editOrderOnPayment) {
            throw new Error("Failed to update order payment status.");
          }
        }
        else
         console.error("Failed to add order to database:", addOrderRes);

        // console.log("Order created successfully:", addOrderRes.data.addOrder);


        // console.log("Order payment updated successfully:", editOrderRes.data.editOrderOnPayment);

        toast.success("Order successfully created and payment updated!", { duration: 800 });

        // Clear cart and localStorage
        resetCart();
        // localStorage.removeItem("You&i_cart");

        // Redirect to user orders page
        router.push(`/user/orders`);
      } catch (error) {
        console.error("Error processing order:", error);
        toast.error("An error occurred while processing the order. Please contact support.", {
          duration: 800,
        });
      } finally {
        setLoading(false);
      }
    };

    handlePaymentSuccess();
  }, [addOrder, editPaidOrder, resetCart, router, orderId, paymentToken, status, transactionUid]);

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 mb-24">
      <div className="w-full rounded-lg shadow-xl sm:max-w-md p-6">
        <div className="flex items-center justify-center space-x-4 p-4 rounded-lg bg-green-600 text-white">
          <h1 className="font-bold text-2xl">Payment Successful!</h1>
          <AiOutlineCheck size={28} />
        </div>
        <ConfettiExplosion className="absolute m-auto" />
        {loading && (
          <div className="mt-4 text-center text-gray-600">
            <p>Processing your order...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuccessPaymentComponent;
