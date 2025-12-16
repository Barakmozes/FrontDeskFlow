import { getCurrentUser } from "@/lib/session";
import SuccessPaymentComponent from "./SuccessPaymentComponent";

const SuccessfulPaymentPage = async () => {
  const user = await getCurrentUser();

  if (!user) return <div>Authentication required to view this page.</div>;

  return <SuccessPaymentComponent />;
};

export default SuccessfulPaymentPage;
