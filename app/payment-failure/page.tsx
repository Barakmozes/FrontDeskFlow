import { getCurrentUser } from "@/lib/session";
import PaymentFailureComponent from "./PaymentFailureComponent";

const PaymentFailurePage = async () => {
  const user = await getCurrentUser();

  if (!user) return <div>Authentication required to view this page.</div>;

  return <PaymentFailureComponent />;
};

export default PaymentFailurePage;
