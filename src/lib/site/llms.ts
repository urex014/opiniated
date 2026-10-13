const SITE = "https://opiniated.vercel.app";

type Page = {
  title: string;
  path: string;
  summary: string;
};

const sections: { heading: string; pages: Page[] }[] = [
  {
    heading: "Product",
    pages: [
      {
        title: "Your opinions are worth something",
        path: "/",
        summary:
          "Explains how to create an account, take online surveys you qualify for, and earn rewards only after a verified completion.",
      },
      {
        title: "How it works",
        path: "/how-it-works",
        summary:
          "Explains how surveys are listed, answered on the provider site, credited from a signed callback, reversed when needed, and paid out once the balance reaches $5.00.",
      },
    ],
  },
  {
    heading: "Company",
    pages: [
      {
        title: "About",
        path: "/about",
        summary:
          "Describes Opiniated as a survey rewards site that lists CPX Research surveys and records only the rewards that provider confirms.",
      },
      {
        title: "Help",
        path: "/help",
        summary:
          "Explains empty survey lists, retries, and that a reward or payout is added only after a verified completion and a saved bank account.",
      },
      {
        title: "Contact",
        path: "/contact",
        summary: "Tells visitors where to email about account help, reward questions, and privacy requests.",
      },
    ],
  },
  {
    heading: "Policies",
    pages: [
      {
        title: "Privacy Policy",
        path: "/privacy",
        summary:
          "Describes the account data Opiniated keeps, the session cookie, and that survey companies are separate from this site.",
      },
      {
        title: "Terms of Service",
        path: "/terms",
        summary: "Sets the account, reward, reversal, and payout rules, including that 100 OPN equal $1.00.",
      },
    ],
  },
];

export function pageUrl(path: string): string {
  return path === "/" ? `${SITE}/` : `${SITE}${path}`;
}

export function llmsPages(): Page[] {
  return sections.flatMap((section) => section.pages);
}

export function llmsTxt(): string {
  const lines = [
    "# Opiniated",
    "",
    "> Share your views through online surveys and earn rewards for the time you spend participating.",
    "",
  ];
  for (const section of sections) {
    lines.push(`## ${section.heading}`, "");
    for (const page of section.pages) {
      lines.push(`- [${page.title}](${pageUrl(page.path)}): ${page.summary}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
