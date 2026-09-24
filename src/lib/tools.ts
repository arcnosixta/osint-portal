export type ToolStatus = "online" | "module" | "planned";

export type ToolCategory =
  | "network"
  | "username"
  | "dns"
  | "web"
  | "data"
  | "framework";

export interface Tool {
  id: string;
  name: string;
  command: string;
  desc: { en: string; ru: string };
  category: ToolCategory;
  tags: string[];
  status: ToolStatus;
  local?: boolean;
  url?: string;
}

export const TOOL_CATEGORIES: Record<
  ToolCategory,
  { en: string; ru: string }
> = {
  network: { en: "Network", ru: "Сеть" },
  username: { en: "Usernames", ru: "Юзернеймы" },
  dns: { en: "DNS", ru: "DNS" },
  web: { en: "Web", ru: "Веб" },
  data: { en: "Data", ru: "Данные" },
  framework: { en: "Frameworks", ru: "Фреймворки" },
};

export const TOOLS: Tool[] = [
  {
    id: "nmap",
    name: "Nmap",
    command: "nmap -sV -sC target",
    desc: {
      en: "Port scanning, service detection and OS fingerprinting for authorized recon.",
      ru: "Сканирование портов, определение сервисов и ОС для авторизованной разведки.",
    },
    category: "network",
    tags: ["ports", "fingerprint"],
    status: "online",
    local: true,
  },
  {
    id: "netcat",
    name: "Netcat",
    command: "nc -zv host 1-1024",
    desc: {
      en: "Swiss-army TCP/UDP toolkit: port probing, banners and raw data plumbing.",
      ru: "Швейцарский нож TCP/UDP: проверка портов, баннеры и перекачка данных.",
    },
    category: "network",
    tags: ["tcp", "udp", "banners"],
    status: "online",
    local: true,
  },
  {
    id: "traceroute",
    name: "Traceroute",
    command: "traceroute -n host",
    desc: {
      en: "Map the network path to a host: hops, gateways and per-hop latency.",
      ru: "Карта сетевого пути до хоста: хопы, шлюзы и задержка на каждом хопе.",
    },
    category: "network",
    tags: ["path", "hops", "latency"],
    status: "online",
    local: true,
  },
  {
    id: "whois",
    name: "Whois",
    command: "whois example.com",
    desc: {
      en: "Registry data: ownership, contacts, registration dates and name servers.",
      ru: "Регистрационные данные: владелец, контакты, даты и NS-серверы.",
    },
    category: "dns",
    tags: ["rdap", "registrar"],
    status: "online",
    local: true,
  },
  {
    id: "dig",
    name: "Dig",
    command: "dig example.com ANY +noall +answer",
    desc: {
      en: "DNS lookup and zone walking: A, MX, TXT, NS, CNAME and DNSSEC records.",
      ru: "DNS-запросы и обход зон: A, MX, TXT, NS, CNAME и DNSSEC записи.",
    },
    category: "dns",
    tags: ["dns", "records"],
    status: "online",
    local: true,
  },
  {
    id: "host",
    name: "Host",
    command: "host -t mx example.com",
    desc: {
      en: "Lightweight forward and reverse DNS resolution helper.",
      ru: "Лёгкий инструмент прямой и обратной DNS-резолюции.",
    },
    category: "dns",
    tags: ["dns", "lookup"],
    status: "online",
    local: true,
  },
  {
    id: "sherlock",
    name: "Sherlock",
    command: "sherlock --timeout 5 username",
    desc: {
      en: "Find usernames across 400+ social networks and platforms.",
      ru: "Поиск username по 400+ соцсетям и платформам.",
    },
    category: "username",
    tags: ["osint", "social", "usernames"],
    status: "online",
    local: true,
    url: "https://github.com/sherlock-project/sherlock",
  },
  {
    id: "maigret",
    name: "Maigret",
    command: "maigret username",
    desc: {
      en: "Username search across thousands of sites with category tagging.",
      ru: "Поиск username по тысячам сайтов с категоризацией.",
    },
    category: "username",
    tags: ["osint", "social"],
    status: "planned",
    url: "https://github.com/soxoj/maigret",
  },
  {
    id: "theHarvester",
    name: "theHarvester",
    command: "theHarvester -d example.com -b all",
    desc: {
      en: "Emails, subdomains, hosts and employee names from public sources.",
      ru: "Email'ы, поддомены, хосты и сотрудники из открытых источников.",
    },
    category: "web",
    tags: ["emails", "subdomains"],
    status: "planned",
    url: "https://github.com/laramies/theHarvester",
  },
  {
    id: "sublist3r",
    name: "Sublist3r",
    command: "sublist3r -d example.com",
    desc: {
      en: "Subdomain enumeration through search engines and certificate logs.",
      ru: "Перечисление поддоменов через поисковики и логи сертификатов.",
    },
    category: "dns",
    tags: ["subdomains", "cert"],
    status: "planned",
    url: "https://github.com/aboul3la/Sublist3r",
  },
  {
    id: "curl",
    name: "curl",
    command: "curl -sI https://example.com",
    desc: {
      en: "Transfer data from or to servers; headers, cookies and API probing.",
      ru: "Передача данных; заголовки, cookie и разведка API.",
    },
    category: "web",
    tags: ["http", "headers"],
    status: "online",
    local: true,
  },
  {
    id: "openssl",
    name: "OpenSSL",
    command: "openssl s_client -connect host:443 -servername host",
    desc: {
      en: "TLS fingerprinting: issuer, validity, SAN list and SHA-256 of live certs.",
      ru: "TLS-отпечаток: издатель, срок действия, SAN и SHA-256 живых сертификатов.",
    },
    category: "web",
    tags: ["tls", "cert", "fingerprint"],
    status: "online",
    local: true,
  },
  {
    id: "gobuster",
    name: "Gobuster",
    command: "gobuster dir -u target -w wordlist.txt",
    desc: {
      en: "Brute-force directories, subdomains and virtual hosts.",
      ru: "Перебор каталогов, поддоменов и виртуальных хостов.",
    },
    category: "web",
    tags: ["brute", "dirs"],
    status: "planned",
    url: "https://github.com/OJ/gobuster",
  },
  {
    id: "masscan",
    name: "Masscan",
    command: "masscan target -p0-65535 --rate 1000",
    desc: {
      en: "Ultra-fast port scanning across huge ranges at line speed.",
      ru: "Сверхбыстрое сканирование больших диапазонов портов.",
    },
    category: "network",
    tags: ["ports", "fast"],
    status: "planned",
    url: "https://github.com/robertdavidgraham/masscan",
  },
  {
    id: "dnsrecon",
    name: "DNSRecon",
    command: "dnsrecon -d example.com -t std",
    desc: {
      en: "Complete DNS enumeration: records, zones, cache snooping and more.",
      ru: "Полная DNS-разведка: записи, зоны, cache snooping и другое.",
    },
    category: "dns",
    tags: ["dns", "enum"],
    status: "planned",
    url: "https://github.com/darkoperator/dnsrecon",
  },
  {
    id: "jq",
    name: "jq",
    command: "curl -s api | jq '.results[0]'",
    desc: {
      en: "Slice, filter and reshape JSON streams right in the pipeline.",
      ru: "Нарезка, фильтрация и трансформация JSON прямо в пайплайне.",
    },
    category: "data",
    tags: ["json", "transform"],
    status: "online",
    local: true,
  },
  {
    id: "python3",
    name: "Python",
    command: "python3 tool.py target",
    desc: {
      en: "Scriptable glue for custom collectors and evidence processing.",
      ru: "Скриптовый клей для своих сборщиков и обработки улик.",
    },
    category: "data",
    tags: ["scripting", "glue"],
    status: "online",
    local: true,
  },
  {
    id: "flowsint",
    name: "Flowsint",
    command: "flowsint --graph target",
    desc: {
      en: "OSINT graph exploration: map entities and connections visually.",
      ru: "Графовая OSINT-разведка: визуальные связи между объектами.",
    },
    category: "framework",
    tags: ["graph", "visual"],
    status: "module",
    url: "https://github.com/dexters1/Flowsint",
  },
];

export const CATEGORY_ICONS: Record<ToolCategory, string> = {
  network: "network",
  username: "user",
  dns: "globe",
  web: "browser",
  data: "database",
  framework: "layers",
};

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}