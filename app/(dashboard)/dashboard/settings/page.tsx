// app/(dashboard)/dashboard/settings/page.tsx
import { getCurrentUser } from "@/lib/session";
import Container from "@/app/components/Common/Container";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="bg-slate-100 min-h-screen">
      <Container>
        <SettingsClient
          currentUserEmail={user?.email ?? null}
          currentUserRole={(user as any)?.role ?? null}
        />
      </Container>
    </div>
  );
}
