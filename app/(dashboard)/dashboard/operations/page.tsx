import { getCurrentUser } from "@/lib/session";
import OperationsBoard from "@/app/components/Restaurant_interface/Operations/OperationsBoard";

export default async function OperationsPage() {
  const user = await getCurrentUser();
  return <OperationsBoard currentUserEmail={user?.email ?? null} />;
}
