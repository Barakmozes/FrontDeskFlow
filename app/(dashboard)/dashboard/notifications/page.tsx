// app/(dashboard)/dashboard/notifications/page.tsx
import { getCurrentUser } from "@/lib/session";
import Container from '@/app/components/Common/Container'
import React from 'react'
import NotificationsList from './NotificationsList'


export default async function Page() {
   const user = await getCurrentUser();
  return (
    <Container>
      <div className="  rounded-lg shadow-2xl p-6 my-12 max-h-[80vh] overflow-y-auto bg-white">

     <NotificationsList userEmail={user?.email ?? null} />;
      </div>
    </Container>
  )
}

