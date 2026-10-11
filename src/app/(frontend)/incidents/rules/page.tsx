import React from 'react'
import { deskRules } from '@/lib/desk'

export const metadata = { title: 'How incidents open — WFM Labs' }

// Public, read-only: the rules that OPEN incidents, read live from desk-api GET /desk/rules so this
// page can never drift from what actually runs.
export default async function IncidentRulesPage() {
  const data = await deskRules()
  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        {' / '}
        <a href="/incidents" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Incidents</a>
        {' / '}
        Rules
      </nav>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>How incidents open</h1>
      <p style={{ color: 'var(--fg-muted)', lineHeight: 1.6, fontSize: '0.9375rem' }}>
        The desk watches live items — degraded airports, diversions, cancellations, scored headlines, forecast cones, SIGMETs.
        When one of the rules below fires at severity 5 or above, the desk <strong>opens</strong> an incident at once, graded
        by severity and by the legs of a trip it affects (air, hotel, rail, ground). A person closes a false positive from the
        alert email or on the incident page; a story closed once is never re-opened by the same rule.
      </p>
      {!data ? (
        <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>The rules could not be read from desk-api just now — this is a connection issue, not an empty rulebook.</p>
      ) : (
        <>
          <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Ruleset {data.rule.id} {data.rule.version} · {data.rules.length} rules · read live from desk-api
          </p>
          <ol style={{ paddingLeft: '1.25rem', display: 'grid', gap: '0.875rem' }}>
            {data.rules.map((r) => (
              <li key={r.id} style={{ lineHeight: 1.55 }}>
                <div style={{ fontWeight: 600 }}>
                  {r.id.replace(/_/g, ' ')} <span style={{ color: 'var(--fg-faint)', fontWeight: 400, fontSize: '0.8125rem' }}>{r.version}</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>{r.describe}</div>
              </li>
            ))}
          </ol>
          <p style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Closures outside the US are inferred from flights and news — there is no NOTAM feed behind this. Severity follows the
            canonical scale (SEV1 ≥ 9, SEV2 ≥ 7, SEV3 ≥ 5). Every incident the desk opens records which rule fired and on what facts.
          </p>
        </>
      )}
    </div>
  )
}
