import { getCurrentUser } from "@/lib/session";
import FolioClient from "./folio.client";

export default async function FolioPage({
  params,
}: {
  params: { reservationId: string };
}) {
  const user = await getCurrentUser();
  return (
    <FolioClient
      reservationId={params.reservationId}
      staffEmail={user?.email ?? null}
    />
  );
}
