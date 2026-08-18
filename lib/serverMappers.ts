// Pure row<->object mappers shared by server route handlers.
// No supabase import, safe to use server-side. Never returns password fields.

export function mapUser(r: Record<string, any>) {
  return {
    id: r.id, name: r.name, role: r.role, phone: r.phone,
    email: r.email || undefined,
    wholesalerId: r.wholesaler_id || undefined,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : undefined,
  }
}

export function mapProfile(d: Record<string, any>) {
  return {
    userId: d.user_id, ragioneSociale: d.ragione_sociale, piva: d.piva, codiceFiscale: d.codice_fiscale,
    indirizzoFattura: d.indirizzo_fattura, capFattura: d.cap_fattura, cittaFattura: d.citta_fattura,
    provinciaFattura: d.provincia_fattura, codiceSdi: d.codice_sdi, pec: d.pec,
    indirizzoSpedizione: d.indirizzo_spedizione, capSpedizione: d.cap_spedizione, cittaSpedizione: d.citta_spedizione,
    noteConsegna: d.note_consegna, emailOrdini: d.email_ordini, telefono: d.telefono,
  }
}

export function profileToRow(p: Record<string, any>) {
  return {
    user_id: p.userId,
    ragione_sociale: p.ragioneSociale || null, piva: p.piva || null,
    codice_fiscale: p.codiceFiscale || null, indirizzo_fattura: p.indirizzoFattura || null,
    cap_fattura: p.capFattura || null, citta_fattura: p.cittaFattura || null,
    provincia_fattura: p.provinciaFattura || null, codice_sdi: p.codiceSdi || null,
    pec: p.pec || null, indirizzo_spedizione: p.indirizzoSpedizione || null,
    cap_spedizione: p.capSpedizione || null, citta_spedizione: p.cittaSpedizione || null,
    note_consegna: p.noteConsegna || null, email_ordini: p.emailOrdini || null,
    telefono: p.telefono || null,
  }
}
