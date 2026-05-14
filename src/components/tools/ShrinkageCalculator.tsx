'use client'

import { useState, useMemo } from 'react'

interface ShrinkageCategory {
  label: string
  key: string
  value: number
  group: 'planned' | 'unplanned'
  description: string
}

const defaultCategories: ShrinkageCategory[] = [
  // Planned
  { label: 'Breaks', key: 'breaks', value: 5.0, group: 'planned', description: 'Scheduled paid breaks' },
  { label: 'Lunch', key: 'lunch', value: 4.2, group: 'planned', description: 'Paid lunch periods' },
  { label: 'Training', key: 'training', value: 3.0, group: 'planned', description: 'Ongoing education, onboarding' },
  { label: 'Coaching', key: 'coaching', value: 2.0, group: 'planned', description: '1:1 sessions, side-by-sides' },
  { label: 'Team Meetings', key: 'meetings', value: 1.5, group: 'planned', description: 'Huddles, town halls, all-hands' },
  { label: 'PTO / Vacation', key: 'pto', value: 6.0, group: 'planned', description: 'Paid time off, holidays' },
  { label: 'Projects / Off-Phone', key: 'projects', value: 1.0, group: 'planned', description: 'Special projects, back-office work' },
  // Unplanned
  { label: 'Absenteeism', key: 'absenteeism', value: 3.0, group: 'unplanned', description: 'Unplanned call-outs, sick days' },
  { label: 'Tardiness', key: 'tardiness', value: 1.0, group: 'unplanned', description: 'Late arrivals, early departures' },
  { label: 'System Downtime', key: 'downtime', value: 0.5, group: 'unplanned', description: 'IT outages, tool failures' },
  { label: 'Extended Breaks', key: 'extBreaks', value: 1.0, group: 'unplanned', description: 'Breaks exceeding scheduled time' },
  { label: 'Personal Time', key: 'personal', value: 0.5, group: 'unplanned', description: 'Bathroom, personal calls beyond break' },
]

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function ShrinkageCalculator() {
  const [categories, setCategories] = useState<ShrinkageCategory[]>(defaultCategories)
  const [baseAgents, setBaseAgents] = useState(100)
  const [annualCostPerFTE, setAnnualCostPerFTE] = useState(45000)
  const [showDescriptions, setShowDescriptions] = useState(false)

  const updateValue = (key: string, value: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value: Math.max(0, Math.min(100, value)) } : c)),
    )
  }

  const results = useMemo(() => {
    const planned = categories.filter((c) => c.group === 'planned')
    const unplanned = categories.filter((c) => c.group === 'unplanned')
    const plannedTotal = planned.reduce((sum, c) => sum + c.value, 0)
    const unplannedTotal = unplanned.reduce((sum, c) => sum + c.value, 0)
    const totalShrinkage = plannedTotal + unplannedTotal

    // FTE impact: base_agents / (1 - shrinkage%) = actual needed
    const shrinkageFraction = totalShrinkage / 100
    const actualAgentsNeeded = shrinkageFraction >= 1 ? Infinity : baseAgents / (1 - shrinkageFraction)
    const additionalFTEs = actualAgentsNeeded - baseAgents
    const additionalCost = additionalFTEs * annualCostPerFTE

    // Per-point impact
    const costPerPoint = baseAgents >= 1 ? (annualCostPerFTE * baseAgents) / ((1 - shrinkageFraction) * 100) : 0

    // Productive hours per 8-hour shift
    const productiveMinutes = 480 * (1 - shrinkageFraction)

    return {
      planned,
      unplanned,
      plannedTotal,
      unplannedTotal,
      totalShrinkage,
      shrinkageFraction,
      actualAgentsNeeded,
      additionalFTEs,
      additionalCost,
      costPerPoint,
      productiveMinutes,
    }
  }, [categories, baseAgents, annualCostPerFTE])

  const barMaxPct = Math.max(results.totalShrinkage, 40)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Staffing Inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={{ padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
            Base Agents Required
          </label>
          <input
            type="number"
            value={baseAgents}
            onChange={(e) => setBaseAgents(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="input"
            style={{ width: '100%', fontSize: '1.25rem', fontWeight: 700 }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginTop: '0.375rem' }}>
            Erlang/requirement before shrinkage
          </p>
        </div>
        <div style={{ padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
            Annual Cost per FTE
          </label>
          <input
            type="number"
            value={annualCostPerFTE}
            onChange={(e) => setAnnualCostPerFTE(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            step={1000}
            className="input"
            style={{ width: '100%', fontSize: '1.25rem', fontWeight: 700 }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginTop: '0.375rem' }}>
            Fully loaded (salary + benefits + overhead)
          </p>
        </div>
      </div>

      {/* Shrinkage Inputs — two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1.5rem' }}>
        {/* Planned */}
        <CategoryGroup
          title="Planned Shrinkage"
          subtitle="Scheduled, predictable time away"
          color="#3b82f6"
          categories={results.planned}
          total={results.plannedTotal}
          onUpdate={updateValue}
          showDescriptions={showDescriptions}
        />
        {/* Unplanned */}
        <CategoryGroup
          title="Unplanned Shrinkage"
          subtitle="Unscheduled, harder to control"
          color="#ef4444"
          categories={results.unplanned}
          total={results.unplannedTotal}
          onUpdate={updateValue}
          showDescriptions={showDescriptions}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowDescriptions(!showDescriptions)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '0.375rem 0.75rem',
            fontSize: '0.75rem',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
          }}
        >
          {showDescriptions ? 'Hide' : 'Show'} descriptions
        </button>
      </div>

      {/* Results Dashboard */}
      <div
        style={{
          border: '2px solid var(--accent)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--accent)',
            color: '#000',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Impact Analysis</h3>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Summary KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <KPICard
              label="Total Shrinkage"
              value={formatPct(results.totalShrinkage)}
              sub={`${formatPct(results.plannedTotal)} planned + ${formatPct(results.unplannedTotal)} unplanned`}
              color={results.totalShrinkage > 35 ? '#ef4444' : results.totalShrinkage > 30 ? '#f59e0b' : '#10b981'}
            />
            <KPICard
              label="Actual FTEs Needed"
              value={results.actualAgentsNeeded === Infinity ? '--' : Math.ceil(results.actualAgentsNeeded).toLocaleString()}
              sub={`+${results.additionalFTEs === Infinity ? '--' : Math.ceil(results.additionalFTEs).toLocaleString()} above base requirement`}
              color="#3b82f6"
            />
            <KPICard
              label="Shrinkage Cost"
              value={results.additionalFTEs === Infinity ? '--' : formatCurrency(results.additionalCost)}
              sub="Annual cost of additional FTEs"
              color="#8b5cf6"
            />
            <KPICard
              label="Productive Time"
              value={`${Math.round(results.productiveMinutes)}m`}
              sub={`of 480m per 8-hour shift (${formatPct((results.productiveMinutes / 480) * 100)} utilization)`}
              color="#10b981"
            />
          </div>

          {/* Visual breakdown bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)' }}>
                Shrinkage Breakdown
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
                Industry benchmark: 30-35%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '2.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                display: 'flex',
                position: 'relative',
              }}
            >
              {/* Planned portion */}
              <div
                style={{
                  width: `${(results.plannedTotal / barMaxPct) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#fff',
                  transition: 'width 0.3s ease',
                  minWidth: results.plannedTotal > 0 ? '3rem' : 0,
                }}
              >
                {results.plannedTotal >= 3 && `${formatPct(results.plannedTotal)}`}
              </div>
              {/* Unplanned portion */}
              <div
                style={{
                  width: `${(results.unplannedTotal / barMaxPct) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#fff',
                  transition: 'width 0.3s ease',
                  minWidth: results.unplannedTotal > 0 ? '3rem' : 0,
                }}
              >
                {results.unplannedTotal >= 3 && `${formatPct(results.unplannedTotal)}`}
              </div>
              {/* Benchmark line at 30% */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(30 / barMaxPct) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: 'var(--fg-faint)',
                  opacity: 0.5,
                }}
              />
              {/* Benchmark line at 35% */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(35 / barMaxPct) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: '#ef4444',
                  opacity: 0.4,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '2px', background: '#3b82f6', display: 'inline-block' }} />
                Planned
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
                Unplanned
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--fg-faint)' }}>
                <span style={{ width: '0.75rem', height: '2px', background: 'var(--fg-faint)', display: 'inline-block' }} />
                30% benchmark
              </span>
            </div>
          </div>

          {/* Category waterfall */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Category Breakdown
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {categories
                .filter((c) => c.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((c) => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ width: '8rem', flexShrink: 0, color: 'var(--fg-muted)', textAlign: 'right' }}>
                      {c.label}
                    </span>
                    <div style={{ flex: 1, height: '1.25rem', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(c.value / (results.totalShrinkage || 1)) * 100}%`,
                          height: '100%',
                          background: c.group === 'planned' ? '#3b82f6' : '#ef4444',
                          borderRadius: '2px',
                          transition: 'width 0.3s ease',
                          minWidth: '2px',
                        }}
                      />
                    </div>
                    <span style={{ width: '3rem', flexShrink: 0, fontWeight: 600, fontSize: '0.75rem' }}>
                      {formatPct(c.value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Sensitivity note */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              fontSize: '0.8125rem',
              color: 'var(--fg-muted)',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            <strong style={{ color: 'var(--fg)' }}>Each 1% of shrinkage</strong> costs{' '}
            <strong style={{ color: 'var(--fg)' }}>
              {results.costPerPoint === Infinity ? '--' : formatCurrency(results.costPerPoint)}
            </strong>{' '}
            annually for your operation. Reducing unplanned shrinkage by even 2 points saves{' '}
            <strong style={{ color: 'var(--fg)' }}>
              {formatCurrency(results.costPerPoint * 2)}
            </strong>.
          </div>
        </div>
      </div>

      {/* Reset button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => {
            setCategories(defaultCategories)
            setBaseAgents(100)
            setAnnualCostPerFTE(45000)
          }}
          className="btn btn-secondary"
          style={{ fontSize: '0.8125rem' }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}

function CategoryGroup({
  title,
  subtitle,
  color,
  categories,
  total,
  onUpdate,
  showDescriptions,
}: {
  title: string
  subtitle: string
  color: string
  categories: ShrinkageCategory[]
  total: number
  onUpdate: (key: string, value: number) => void
  showDescriptions: boolean
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--fg)' }}>{title}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', margin: '0.125rem 0 0' }}>{subtitle}</p>
        </div>
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color,
          }}
        >
          {formatPct(total)}
        </span>
      </div>
      <div style={{ padding: '0.75rem 1.25rem' }}>
        {categories.map((c) => (
          <div
            key={c.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{c.label}</span>
              {showDescriptions && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', margin: '0.125rem 0 0' }}>
                  {c.description}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
              <input
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={c.value}
                onChange={(e) => onUpdate(c.key, parseFloat(e.target.value))}
                style={{
                  width: '5rem',
                  accentColor: color,
                }}
              />
              <input
                type="number"
                value={c.value}
                onChange={(e) => onUpdate(c.key, parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.5}
                style={{
                  width: '3.5rem',
                  padding: '0.25rem 0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textAlign: 'right',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', width: '1rem' }}>%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div
      style={{
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.25rem' }}>{sub}</div>
    </div>
  )
}
