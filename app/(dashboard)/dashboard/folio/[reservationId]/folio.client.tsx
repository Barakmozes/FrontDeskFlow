"use client";

import React, { useMemo } from "react";
import { useQuery } from "@urql/next";

import {
  GetReservationDocument,
  GetReservationQuery,
  GetReservationQueryVariables,

  GetAreaDocument,
  GetAreaQuery,
  GetAreaQueryVariables,

  GetUserDocument,
  GetUserQuery,
  GetUserQueryVariables,
} from "@/graphql/generated";

import FolioPanel from "@/app/components/Restaurant_interface/Folio/FolioPanel";

export default function FolioClient({
  reservationId,
  staffEmail,
}: {
  reservationId: string;
  staffEmail: string | null;
}) {
  // staff role (for override)
  const [{ data: staffData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: { email: staffEmail ?? "" },
    pause: !staffEmail,
  });

  const staffRole = staffData?.getUser?.role ?? null;

  // reservation
  const [{ data, fetching, error }] = useQuery<GetReservationQuery, GetReservationQueryVariables>({
    query: GetReservationDocument,
    variables: { getReservationId: reservationId },
  });

  const reservation = data?.getReservation;

  // hotel (area)
  const areaId = reservation?.table?.areaId ?? null;

  const [{ data: areaData }] = useQuery<GetAreaQuery, GetAreaQueryVariables>({
    query: GetAreaDocument,
    variables: { getAreaId: areaId ?? "" },
    pause: !areaId,
  });

  const hotelName = useMemo(() => {
    return areaData?.getArea?.name ?? "Hotel";
  }, [areaData]);

  if (fetching) return <div className="px-6 py-6 text-sm text-gray-500">Loading folio…</div>;
  if (error) return <div className="px-6 py-6 text-sm text-red-600">Error: {error.message}</div>;
  if (!reservation) return <div className="px-6 py-6 text-sm text-gray-600">Reservation not found.</div>;

  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      <FolioPanel
        reservation={reservation as any}
        hotelName={hotelName}
        staffEmail={staffEmail}
        staffRole={staffRole}
      />
    </div>
  );
}
