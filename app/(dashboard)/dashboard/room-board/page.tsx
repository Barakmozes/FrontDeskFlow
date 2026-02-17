import RoomBoard from "@/app/components/Restaurant_interface/RoomBoard/RoomBoard";

import { getCurrentUser } from "@/lib/session";


export default async function RoomBoardPage() {
 const user = await getCurrentUser()
  return   <RoomBoard staffEmail={user?.email ?? null} />;
}
