import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { Base64 } from "js-base64";

export async function POST(
  request: NextRequest,
  { params }: { params: { total: string } }
) {
  try {
    const { total } = params;
    console.log("Encoded total received:", total);

    const decodedTotal = Base64.decode(total);
    console.log("Decoded total:", decodedTotal);

    const payAmount = Number(decodedTotal);
    console.log("Pay amount in smallest unit:", payAmount);

    if (isNaN(payAmount) || payAmount <= 0) {
      console.error("Invalid pay amount:", payAmount);
      return NextResponse.json(
        { error: "Invalid total amount provided." },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log("Request body received:", body);

    const { orderId, userName, email, userPhone } = body;

    if (!orderId || !userName || !email ) {
      console.error("Missing required fields:", { orderId, userName, email });
      return NextResponse.json(
        { error: "Missing required fields: orderId, userName, email, or userPhone." },
        { status: 400 }
      );
    }

    const paymentData = {
      payment_page_uid: process.env.PAYPLUS_PAGE_UID,
      charge_method: 1,
      amount: payAmount,
      currency_code: "ILS",
      description: `Order #${orderId}`,
      refURL_success: `${process.env.NEXT_PUBLIC_NEXT_URL}/payment-success?orderId=${orderId}`,
      refURL_failure: `${process.env.NEXT_PUBLIC_NEXT_URL}/payment-failure/${orderId}?status=failure`,
      customer: {
        name: userName,
        email,
        phone: userPhone,
      },
      sendEmailApproval: true,
      sendEmailFailure: false,
    };

    console.log("Payment data sent to PayPlus API:", paymentData);

    const payPlusResponse = await axios.post(
      "https://restapidev.payplus.co.il/api/v1.0/PaymentPages/generateLink",
      paymentData,
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.PAYPLUS_API_KEY,
          "secret-key": process.env.PAYPLUS_SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract payment link from the nested response
    const paymentLink = payPlusResponse.data?.data?.payment_page_link;
    console.log("Payment link received:", paymentLink);

    if (!paymentLink) {
      console.error("PayPlus API did not return a payment link:", payPlusResponse.data);
      return NextResponse.json(
        { error: "Failed to generate payment link." },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentLink }, { status: 200 });
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      // Log detailed PayPlus API error response
      console.error(
        "Error response from PayPlus API:",
        JSON.stringify(error.response.data, null, 2)
      );

      return NextResponse.json(
        {
          error: "Failed to generate payment link.",
          details: error.response.data, // Include exact API error details
        },
        { status: error.response.status || 500 }
      );
    }

    // Handle unexpected errors
    console.error("Unexpected error in /api/payplus/[total]/route.ts:", error.message);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      { error: "An unexpected error occurred while generating the payment link." },
      { status: 500 }
    );
  }
}
