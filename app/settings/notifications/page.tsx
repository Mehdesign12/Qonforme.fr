import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = "force-dynamic"
export default function Page() {
  return <div className='bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-8 max-w-2xl text-sm text-slate-500 dark:text-slate-400'>Page en construction — Phase suivante</div>
}
