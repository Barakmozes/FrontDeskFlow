
import { getCurrentUser } from "@/lib/session";
import RoomServiceClient from "./room-service.client";
import type { User } from "@prisma/client";


export default async  function RoomServicePage() {
    const user = (await getCurrentUser()) as User | null;
  return <RoomServiceClient  user={user as User}/>;
}
