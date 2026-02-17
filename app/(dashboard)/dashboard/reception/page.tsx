import { getCurrentUser } from "@/lib/session";
import ReceptionClient from "./reception.client";

export default async function ReceptionPage() {
  const user = await getCurrentUser();
  return <ReceptionClient staffEmail={user?.email ?? null} />;
}
