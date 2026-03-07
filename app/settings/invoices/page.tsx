import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Invoices' }
export const dynamic = "force-dynamic"
export default function Page() {
  return <div className='bg-white rounded-xl border border-[#E2E8F0] p-8 max-w-2xl text-sm text-slate-500'>Page en construction — Phase suivante</div>
}
