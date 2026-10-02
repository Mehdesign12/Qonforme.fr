import { AppLayout } from "@/components/layout/AppLayout"
import { SettingsFrame } from "@/components/settings/SettingsFrame"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <SettingsFrame mode="app">{children}</SettingsFrame>
    </AppLayout>
  )
}
