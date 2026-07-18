import { AuthGate } from "@/components/shell/AuthGate";
import { AppShell } from "@/components/shell/AppShell";
import { ProfileProvider } from "@/components/providers/ProfileProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ProfileProvider>
        <AppShell>{children}</AppShell>
      </ProfileProvider>
    </AuthGate>
  );
}
