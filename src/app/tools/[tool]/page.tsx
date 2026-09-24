import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WebGLBackground from "@/components/hero/WebGLBackground";
import ToolWorkbench from "@/components/workbench/ToolWorkbench";
import { detectLocalToolStatus } from "@/lib/binary";
import { isSegmentConnected } from "@/lib/segments";
import { getToolById, TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

interface ToolPageProps {
  params: Promise<{ tool: string }>;
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { tool } = await params;
  const meta = getToolById(tool);
  if (!meta) return { title: "Tool not found — OSINT Portal" };
  return {
    title: `${meta.name} workbench — OSINT Portal`,
    description: meta.desc.en,
    keywords: ["osint", "tool", meta.name.toLowerCase()],
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { tool } = await params;
  const meta = getToolById(tool);
  if (!meta) notFound();

  const local = detectLocalToolStatus();
  const available = meta.local ? (local[meta.id] ?? false) : null;
  const connected = isSegmentConnected(meta.id);
  const localCount = TOOLS.filter((t) => t.local && local[t.id]).length;

  return (
    <>
      <Navbar />
      <WebGLBackground className="pointer-events-none fixed inset-0 z-0 opacity-60" />
      <main className="relative z-10 pt-24 pb-16">
        <ToolWorkbench
          tool={meta}
          available={available}
          connected={connected}
          localCount={localCount}
          toolCount={TOOLS.length}
        />
      </main>
      <Footer />
    </>
  );
}