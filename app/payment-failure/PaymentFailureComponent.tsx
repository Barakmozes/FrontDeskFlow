'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { AiOutlineClose } from "react-icons/ai";
import { useEffect } from "react";
import toast from "react-hot-toast";

const PaymentFailureComponent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const failureMessage = searchParams.get("message"); // Extract the failure message from the API response

  useEffect(() => {
    // Display a toast message with the failure reason
    if (failureMessage) {
      toast.error(`Payment Failed: ${failureMessage}`, { duration: 5000 });
    } else {
      toast.error("Payment failed. Please try again.", { duration: 5000 });
    }
  }, [failureMessage]);

  const handleRetry = () => {
    router.push("/cart"); // Redirect to the cart for retrying the payment
  };

  const handleContactSupport = () => {
    router.push("/support"); // Redirect to a support page for assistance
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 mb-24">
      <div className="w-full rounded-lg shadow-xl sm:max-w-md p-6">
        <div className="flex items-center justify-center space-x-4 p-4 rounded-lg bg-red-600 text-white">
          <h1 className="font-bold text-2xl">Payment Failed</h1>
          <AiOutlineClose size={28} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-lg text-gray-700">
            Unfortunately, your payment could not be processed.
          </p>
          {failureMessage && (
            <p className="mt-2 text-sm text-gray-500">
              <strong>Reason:</strong> {failureMessage}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col space-y-4">
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Retry Payment
          </button>
          <button
            onClick={handleContactSupport}
            className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailureComponent;
