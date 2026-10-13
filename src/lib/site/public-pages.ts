export type PublicPage = {
  path: string;
  title: string;
  linkTitle: string;
  description: string;
  summary: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

/** Indexable marketing and policy pages. Account, survey, and admin routes stay out. */
export const publicPages: PublicPage[] = [
  {
    path: "/",
    title: "Survey rewards for verified completions",
    linkTitle: "Your opinions are worth something",
    description:
      "Take online surveys you qualify for and earn Opiniated Points after a verified completion. 100 OPN equal $1.00. Payouts start at $5.00 to a verified Nigerian bank account.",
    summary:
      "Explains how to create an account, take online surveys you qualify for, and earn rewards only after a verified completion.",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/how-it-works",
    title: "How survey rewards and payouts work",
    linkTitle: "How it works",
    description:
      "How Opiniated lists surveys, credits a signed provider callback, handles screen-outs and reversals, and pays a Nigerian bank account through Paystack.",
    summary:
      "Explains how surveys are listed, answered on the provider site, credited from a signed callback, reversed when needed, and paid out once the balance reaches $5.00.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/about",
    title: "About Opiniated",
    linkTitle: "About",
    description:
      "Opiniated is a survey rewards site. Surveys come from CPX Research when it is enabled, and only a confirmed completion is recorded as a reward.",
    summary:
      "Describes Opiniated as a survey rewards site that lists CPX Research surveys and records only the rewards that provider confirms.",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/help",
    title: "Survey rewards help",
    linkTitle: "Help",
    description:
      "Answers about empty survey lists, screen-outs, email confirmation, the $5.00 payout minimum, and how to contact Opiniated support.",
    summary:
      "Explains empty survey lists, screen-outs, email confirmation, and that a payout starts at $5.00 to a verified Nigerian bank account.",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/contact",
    title: "Contact Opiniated",
    linkTitle: "Contact",
    description: "Email Opiniated about an account, a reward, a payout, or a privacy request.",
    summary: "Tells visitors where to email about account help, reward questions, and privacy requests.",
    changeFrequency: "yearly",
    priority: 0.4,
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    linkTitle: "Privacy Policy",
    description:
      "What account data Opiniated keeps, how the session cookie works, and how survey providers and Paystack fit in.",
    summary:
      "Describes the account data Opiniated keeps, the session cookie, and that survey companies are separate from this site.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/terms",
    title: "Terms of Service",
    linkTitle: "Terms of Service",
    description:
      "Rules for Opiniated accounts, survey rewards, reversals, and payouts to a verified Nigerian bank account.",
    summary: "Sets the account, reward, reversal, and payout rules, including that 100 OPN equal $1.00.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

export function publicPage(path: string): PublicPage {
  const page = publicPages.find((item) => item.path === path);
  if (!page) throw new Error(`No public page for ${path}`);
  return page;
}
