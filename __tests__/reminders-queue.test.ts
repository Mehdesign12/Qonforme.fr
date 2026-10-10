/**
 * Tests pour lib/reminders/queue.ts (page Relances).
 *
 * La file doit refléter exactement ce que fera le cron send-reminders :
 * relance 1 à J+30, relance 2 à J+45 une fois la 1 partie, uniquement pour les
 * factures « sent » / « overdue » non soldées.
 */
import { describe, it, expect } from 'vitest'
import { buildReminderQueue, type ReminderInvoice } from '@/lib/reminders/queue'

const TODAY = '2026-10-14'

const inv = (id: string, due: string, extra: Partial<ReminderInvoice> = {}): ReminderInvoice => ({
  id, invoice_number: 'F-' + id, client_name: 'Client ' + id, client_email: id + '@exemple.fr',
  due_date: due, total_ttc: 1000, status: 'sent', reminder_1_sent_at: null, reminder_2_sent_at: null, ...extra,
})

describe('buildReminderQueue', () => {
  const q = buildReminderQueue([
    inv('a', '2026-09-01'),                                                          // J+43 : relance 1 en retard, part au prochain passage
    inv('b', '2026-09-10', { reminder_1_sent_at: '2026-10-10T08:00:00Z', status: 'overdue' }), // relance 2 le 25 oct.
    inv('c', '2026-10-20'),                                                          // pas encore échue : relance 1 le 19 nov.
    inv('d', '2026-08-01', { reminder_1_sent_at: '2026-08-31T08:00:00Z', reminder_2_sent_at: '2026-09-15T08:00:00Z', status: 'overdue' }),
    inv('e', '2026-09-05', { status: 'paid', reminder_1_sent_at: '2026-10-05T08:00:00Z' }), // réglée après la relance
    inv('f', '2026-09-20', { client_email: null }),                                  // sans email
    inv('g', '2026-09-01', { status: 'draft' }),                                     // brouillon : jamais relancé
    inv('h', '2026-09-01', { credited_ttc: 1000 }),                                  // soldée par avoir
  ], TODAY)

  it('planifie la bonne relance à la bonne date', () => {
    const byId = Object.fromEntries(q.upcoming.map((u) => [u.id, u]))
    expect(byId.a).toMatchObject({ step: 1, date: TODAY, ready: true, daysLate: 43 })
    expect(byId.b).toMatchObject({ step: 2, date: '2026-10-25', ready: false })
    expect(byId.c).toMatchObject({ step: 1, date: '2026-11-19', ready: false, daysLate: 0 })
    expect(byId.f).toMatchObject({ step: 1, noEmail: true })
  })

  it('écarte brouillons, factures réglées ou soldées', () => {
    const ids = q.upcoming.map((u) => u.id)
    expect(ids).not.toContain('e')
    expect(ids).not.toContain('g')
    expect(ids).not.toContain('h')
  })

  it('trie la file par date d’envoi', () => {
    expect(q.upcoming.map((u) => u.id)).toEqual(['a', 'f', 'b', 'c'])
  })

  it('isole les factures déjà relancées deux fois', () => {
    expect(q.exhausted.map((x) => x.id)).toEqual(['d'])
  })

  it('reconstitue l’historique, réglées comprises', () => {
    expect(q.sent.map((s) => `${s.id}${s.step}`)).toEqual(['b1', 'e1', 'd2', 'd1'])
    expect(q.sent.find((s) => s.id === 'e')!.paid).toBe(true)
  })

  it('calcule les chiffres clés', () => {
    expect(q.stats).toEqual({ lateAmount: 4000, lateCount: 4, next10Count: 1, sent30Count: 3 })
  })
})
