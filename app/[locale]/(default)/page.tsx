import { redirect } from "next/navigation";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  redirect("/generate");
}
