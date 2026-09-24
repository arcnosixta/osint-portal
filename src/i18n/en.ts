export const en = {
  meta: {
    title: "OSINT Portal — Unified Open Source Intelligence",
    description:
      "One open-source platform, every OSINT tool. Sherlock, netcat, nmap and friends orchestrated behind a single beautiful interface.",
  },
  nav: {
    tools: "Tools",
    pipeline: "Pipeline",
    ethics: "Ethics",
    github: "GitHub",
    version: "v0.1.0",
  },
  hero: {
    kicker: "OPEN SOURCE INTELLIGENCE",
    title: ["OSINT", "PORTAL"],
    subtitle:
      "Every recon tool in one place. Sherlock, netcat, nmap, whois and dozens more — installed locally, orchestrated through one clean interface.",
    ctaPrimary: "Open the tools",
    ctaSecondary: "How it works",
    status: "system online",
    coordinates: "43.2°N · 76.9°E · noctis",
    terminalPrompt: "operator@osint-portal",
    terminalLines: [
      { cmd: "sherlock --timeout 5 alex", out: "▸ 47 hits across 412 platforms" },
      { cmd: "nmap -sV -sC 10.0.0.7", out: "▸ 6 ports open · services fingerprinted" },
      { cmd: "whois example.com | jq '.registrar'", out: '▸ "Namecheap Inc"' },
      { cmd: "netcat -zv 10.0.0.7 1-1024", out: "▸ 22/tcp open · 80/tcp open" },
    ],
  },
  metrics: {
    label: "live inventory",
    tools: "modules",
    local: "installed locally",
    categories: "capabilities",
    footprint: "sleek footprint",
    footnote: "self-hosted · no cloud · data never leaves your machine",
  },
  tools: {
    kicker: "tool library",
    title: "Every tool. One mission.",
    subtitle:
      "A growing catalog of battle-tested OSINT utilities — installed locally, validated, and wired into visual workbenches. New modules land one by one.",
    statusOnline: "online",
    statusModule: "module",
    statusPlanned: "planned",
  },
  pipeline: {
    kicker: "how it works",
    title: "One run. Full pipeline.",
    subtitle:
      "OSINT is a chain, not a single command. The portal connects the links so you never lose the thread.",
    steps: [
      {
        id: "collect",
        title: "Collect",
        desc: "Pull raw signals from public sources with dedicated collectors.",
      },
      {
        id: "correlate",
        title: "Correlate",
        desc: "Link entities — names, handles, hosts, domains — into a single graph.",
      },
      {
        id: "analyze",
        title: "Analyze",
        desc: "Score confidence, surface patterns and drop the noise.",
      },
      {
        id: "visualize",
        title: "Visualize",
        desc: "Explore the relation graph and read stories in the network.",
      },
      {
        id: "report",
        title: "Report",
        desc: "Export a clean, reproducible evidence trail in one click.",
      },
    ],
    stepsLabel: "stage",
  },
  ethics: {
    kicker: "responsible use",
    title: "Power demands discipline.",
    subtitle:
      "OSINT tooling is for ethical investigations: security assessments you are authorized to run, transparency research, and verification.",
    points: [
      "Run only against assets and targets you own or are authorized to test.",
      "Never exfiltrate, harass, doxx or stalk. Legal data does not mean legal intent.",
      "Follow local laws, the targets' terms of service, and your own conscience.",
    ],
    license: "Licensed under Apache-2.0 · contributions welcome",
  },
  footer: {
    tagline: "One portal. All the pieces.",
    made: "crafted at night, shipped in the dark",
    rights: "open source · free forever",
    built: "built with",
  },
};

export type Dictionary = typeof en;