import InfoLayout from '../components/InfoLayout'
import { STORE } from '../constants/store'

export default function Contact() {
  return <InfoLayout eyebrow="We are here to help" title="Let’s talk." intro="Need help choosing a product, tracking an order, or starting a return? Send us a note and we’ll point you in the right direction."><div className="grid gap-8 sm:grid-cols-2"><div><p className="text-sm font-bold uppercase tracking-wider text-slate-400">Customer support</p><a href={`mailto:${STORE.email}`} className="mt-2 block text-lg font-bold text-rose-600">{STORE.email}</a><a href={`tel:${STORE.phone}`} className="mt-2 block text-slate-700">{STORE.phone}</a><p className="mt-3 text-sm leading-6 text-slate-500">{STORE.hours}</p></div><div><p className="text-sm font-bold uppercase tracking-wider text-slate-400">Our location</p><p className="mt-2 leading-7 text-slate-700">{STORE.address}</p><a href={STORE.instagram} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-semibold text-rose-600">Follow us on Instagram →</a></div></div></InfoLayout>
}
