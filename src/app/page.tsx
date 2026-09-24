import Navbar from "@/components/Navbar";
import Hero from "@/components/hero/Hero";
import Metrics from "@/components/Metrics";
import ToolsGrid from "@/components/ToolsGrid";
import Pipeline from "@/components/Pipeline";
import Ethics from "@/components/Ethics";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="relative">
        <Hero />
        <Metrics />
        <ToolsGrid />
        <Pipeline />
        <Ethics />
      </main>
      <Footer />
    </>
  );
}