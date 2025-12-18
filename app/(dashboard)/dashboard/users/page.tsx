import { redirect } from "next/navigation";
import Container from "@/app/components/Common/Container";
import { getCurrentUser } from "@/lib/session";
import AdminUserTable from "./AdminUserTable";
import type { User } from "@prisma/client";

export default async function AdminUsersPage() {
  const user = (await getCurrentUser()) as User | null;

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <Container>
      <AdminUserTable />
    </Container>
  );
}
