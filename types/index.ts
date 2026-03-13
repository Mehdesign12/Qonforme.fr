// =============================================================================
// QONFORME — Types TypeScript globaux
// =============================================================================

// ---- Profil utilisateur / entreprise ----
export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  company: Company | null
  plan: SubscriptionPlan
  created_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string           // Raison sociale
  siren: string          // 9 chiffres
  siret?: string         // 14 chiffres
  vat_number?: string    // FR + 11 chiffres
  address: string
  zip_code: string
  city: string
  country: string
  iban?: string
  logo_url?: string
  invoice_prefix?: string  // ex: "F"
  invoice_sequence: number // prochain numéro
  payment_terms?: string
  created_at: string
}

// ---- Client ----
export interface Client {
  id: string
  user_id: string
  name: string
  siren?: string
  vat_number?: string
  email?: string
  phone?: string
  address?: string
  zip_code?: string
  city?: string
  country: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

// ---- Facture ----
export type InvoiceStatus =
  | 'draft'      // Brouillon
  | 'sent'       // Envoyée
  | 'pending'    // En attente PPF
  | 'received'   // Reçue par le PPF
  | 'accepted'   // Acceptée
  | 'rejected'   // Rejetée
  | 'paid'       // Payée
  | 'overdue'    // En retard
  | 'cancelled'  // Annulée
  | 'credited'   // Avoir émis

export interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unit_price_ht: number   // Prix unitaire HT
  vat_rate: 0 | 5.5 | 10 | 20  // Taux TVA en %
  total_ht: number        // quantity * unit_price_ht
  total_vat: number       // total_ht * vat_rate / 100
  total_ttc: number       // total_ht + total_vat
}

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  client?: Client
  invoice_number: string   // ex: F-2025-001
  status: InvoiceStatus
  issue_date: string
  due_date: string
  lines: InvoiceLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  payment_terms?: string
  pdf_url?: string
  facturx_url?: string
  ppf_submission_id?: string
  ppf_status?: string
  sent_at?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

// ---- Devis ----
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

export interface Quote {
  id: string
  user_id: string
  client_id: string
  client?: Client
  quote_number: string    // ex: D-2025-001
  status: QuoteStatus
  issue_date: string
  valid_until: string
  lines: InvoiceLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  converted_invoice_id?: string
  created_at: string
  updated_at: string
}

// ---- Abonnement ----
export type SubscriptionPlan = 'starter' | 'pro'

export interface Subscription {
  id: string
  user_id: string
  plan: SubscriptionPlan
  stripe_customer_id?: string
  stripe_subscription_id?: string
  billing_period: 'monthly' | 'yearly'
  current_period_start?: string
  current_period_end?: string
  status: 'active' | 'past_due' | 'canceled' | 'incomplete'
  invoices_this_month: number
  created_at: string
}

// ---- Dashboard stats ----
export interface DashboardStats {
  revenue_current_month: number
  revenue_previous_month: number
  invoices_sent_count: number
  invoices_pending_amount: number
  invoices_overdue_amount: number
  recent_invoices: Invoice[]
  ppf_connected: boolean
}

// ---- INSEE Sirene (API) ----
export interface SireneResult {
  siren: string
  siret?: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
  activity_code?: string
}
