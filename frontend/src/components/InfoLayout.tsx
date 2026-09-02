import type { ReactNode } from 'react'

export default function InfoLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="min-h-[calc(100vh-4rem)] bg-[#f7f8fa] px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="mx-auto max-w-5xl"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-600">{eyebrow}</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1><p className="mt-4 text-lg leading-8 text-slate-500">{intro}</p></div><div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">{children}</div></div></main>
}
