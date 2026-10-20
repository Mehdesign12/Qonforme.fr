import { SettingsFrame } from "@/components/settings/SettingsFrame"

/** Réglages : cadre propre aux réglages, dans la coque commune de l'application (app/(app)/layout.tsx). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame mode="app">{children}</SettingsFrame>
}
