// -----------------------------------------------------------------------------
// SStore brand & support configuration.
//
// Every value is environment-driven so we never bake a phone number, email or
// Instagram handle into a code change. Override via .env.local:
//   VITE_STORE_NAME=...
//   VITE_STORE_EMAIL=...
//   VITE_STORE_PHONE=...
//   VITE_STORE_ADDRESS=...
//   VITE_STORE_HOURS=...
//   VITE_STORE_INSTAGRAM=...
//   VITE_STORE_TAGLINE=...
// -----------------------------------------------------------------------------

export const STORE = {
  name:    import.meta.env.VITE_STORE_NAME    || 'SStore',
  email:   import.meta.env.VITE_STORE_EMAIL   || 'support@sstore.example',
  phone:   import.meta.env.VITE_STORE_PHONE   || '+91 90219 01050',
  address: import.meta.env.VITE_STORE_ADDRESS || 'Kalewadi Pachpir Chowk, Pimpri-Chinchwad, Maharashtra 411017, India',
  hours:   import.meta.env.VITE_STORE_HOURS   || 'Monday to Friday, 9:00 AM to 6:00 PM IST',
  instagram: import.meta.env.VITE_STORE_INSTAGRAM || '',
  tagline: import.meta.env.VITE_STORE_TAGLINE || 'Thoughtful products for everyday living, delivered with care.',
  paymentsAccepted: (import.meta.env.VITE_STORE_PAYMENTS || 'UPI,Card,Net banking,COD')
                       .split(',')
                       .map((s: string) => s.trim())
                       .filter(Boolean),
}
