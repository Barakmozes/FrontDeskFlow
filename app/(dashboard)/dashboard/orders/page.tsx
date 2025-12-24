import Container from "@/app/components/Common/Container";
import { getCurrentUser } from "@/lib/session";
import AdminOrderTable from "./AdminOrderTable";

export default async function AdminOrdersPage() {
  const user = await getCurrentUser();

  return (
    <Container>
      <AdminOrderTable staffEmail={user?.email ?? null} />
    </Container>
  );
}
