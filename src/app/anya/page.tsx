import type { Metadata } from "next";
import { AnyaChatPage } from "@/components/anya/AnyaChatPage";

export const metadata: Metadata = {
  title: "Anya — AI Chat",
  description: "Full-screen Anya chat with a slow mood-reactive backdrop.",
};

export default function Page() {
  return <AnyaChatPage />;
}