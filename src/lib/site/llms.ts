import { absoluteUrl } from "@/lib/site/origin";
import { publicPages } from "@/lib/site/public-pages";

const sections: { heading: string; paths: string[] }[] = [
  { heading: "Product", paths: ["/", "/how-it-works"] },
  { heading: "Company", paths: ["/about", "/help", "/contact"] },
  { heading: "Policies", paths: ["/privacy", "/terms"] },
];

export function llmsTxt(): string {
  const lines = [
    "# Opiniated",
    "",
    "> Share your views through online surveys and earn rewards for the time you spend participating.",
    "",
  ];
  for (const section of sections) {
    lines.push(`## ${section.heading}`, "");
    for (const path of section.paths) {
      const page = publicPages.find((item) => item.path === path);
      if (!page) continue;
      lines.push(`- [${page.linkTitle}](${absoluteUrl(page.path)}): ${page.summary}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
