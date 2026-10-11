import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-wash">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
