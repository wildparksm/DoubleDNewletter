import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TemplateSelector from "./TemplateSelector";

export default async function NewNewsletterPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <TemplateSelector />;
}
