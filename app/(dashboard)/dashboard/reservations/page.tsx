import { getCurrentUser } from "@/lib/session";
import ReservationsList from "./ReservationsList";

export default async function Page() {
  const user = await getCurrentUser();

  return (
    <ReservationsList
      staffEmail={user?.email ?? null}
      staffRole={(user as any)?.role ?? null}
    />
  );
}
