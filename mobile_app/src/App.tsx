import { useState, useEffect, useCallback } from 'react'

// ── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg:      '#3A1078',
  mid:     '#4E31AA',
  blue:    '#2F58CD',
  sky:     '#3795BD',
  text:    '#f0edff',
  muted:   '#c4b5f4',
  faint:   'rgba(196,181,244,.45)',
}

// ── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  home:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  scan:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  files:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  convert:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  upload:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="20 6 9 17 4 12"/></svg>,
  trash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  star:     <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starOut:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  close:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bell:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  search:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  zap:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  chevron:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="9 18 15 12 9 6"/></svg>,
  back:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="15 18 9 12 15 6"/></svg>,
  photo:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  doc:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  share:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  history:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/><polyline points="12 7 12 12 15 15"/></svg>,
  wifi:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3"/></svg>,
  battery:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><rect x="3" y="8" width="12" height="8" rx="1" fill="currentColor" stroke="none"/></svg>,
  table:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  layers:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  eye:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  edit:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  camera:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  grid:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
}

function Ico({ n, size = 20, color = 'currentColor' }: { n: keyof typeof Ic; size?: number; color?: string }) {
  return <span style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, color }}>{Ic[n]}</span>
}

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'templates' | 'scan' | 'workspace' | 'settings'

type TemplateItem = {
  id: number; name: string; type: 'docx' | 'xlsx'; variables: string[]
  date: string; starred: boolean
}

type ScannedPage = {
  id: number; label: string; status: 'pending' | 'done'
}

// ── Data ────────────────────────────────────────────────────────────────────
const TEMPLATES: TemplateItem[] = [
  { id: 1, name: 'Ficha Deportiva', type: 'docx', variables: ['nombre', 'edad', 'club', 'posición', 'fecha'], date: '28 Jul', starred: true },
  { id: 2, name: 'Control Médico', type: 'docx', variables: ['paciente', 'peso', 'talla', 'presión'], date: '25 Jul', starred: false },
  { id: 3, name: 'Registro Atletas', type: 'xlsx', variables: ['nombre', 'categoría', 'tiempo', 'marca'], date: '22 Jul', starred: true },
  { id: 4, name: 'Certificado Participación', type: 'docx', variables: ['participante', 'evento', 'fecha', 'lugar', 'organizador'], date: '20 Jul', starred: false },
  { id: 5, name: 'Inventario Equipos', type: 'xlsx', variables: ['item', 'cantidad', 'estado'], date: '18 Jul', starred: false },
]

const ACTIVITY = [
  { id: 1, label: 'Escaneado', name: 'Ficha deportiva #12', time: 'Hace 2h', icon: 'scan' as const, color: P.sky },
  { id: 2, label: 'Generado', name: 'Certificado.docx', time: 'Hace 5h', icon: 'doc' as const, color: P.blue },
  { id: 3, label: 'Plantilla subida', name: 'ControlMedico.docx', time: 'Ayer', icon: 'upload' as const, color: '#a78bfa' },
  { id: 4, label: 'OCR procesado', name: '3 páginas extraídas', time: '28 Jul', icon: 'eye' as const, color: '#10b981' },
]

const RECENT_DOCS = [
  { id: 1, name: 'Ficha #12', type: 'docx', date: 'Hoy' },
  { id: 2, name: 'Registro Atletas', type: 'xlsx', date: 'Ayer' },
  { id: 3, name: 'Certificado Pérez', type: 'docx', date: '28 Jul' },
  { id: 4, name: 'Control Médico #5', type: 'docx', date: '27 Jul' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatusBar() {
  const [time, setTime] = useState(() => {
    const d = new Date()
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
  })
  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date()
      setTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`)
    }, 10000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="status-bar">
      <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 15, color: P.text }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ico n="wifi" size={14} color={P.text} />
        <Ico n="battery" size={18} color={P.text} />
      </div>
    </div>
  )
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 80 }} className="anim-slide-up">
      <div style={{
        background: 'linear-gradient(135deg, #2F58CD, #3795BD)',
        borderRadius: 16, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 28px rgba(47,88,205,.5)',
      }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico n="check" size={13} color="#fff" />
        </div>
        <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 14, color: '#fff' }}>{msg}</span>
      </div>
    </div>
  )
}

function ToggleBtn({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className={`toggle ${on ? 'on' : 'off'}`} onClick={() => setOn(!on)}>
      <div className="toggle-knob" />
    </div>
  )
}

// ── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ onNav }: { onNav: (t: Tab) => void }) {
  const hour = new Date().getHours()
  const greet = hour < 12 ? '☀️  Buenos días' : hour < 18 ? '👋  Buenas tardes' : '🌙  Buenas noches'

  return (
    <div className="page-scroll">
      <div style={{ padding: '8px 20px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }} className="anim-slide-up">
          <div>
            <p style={{ color: P.muted, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{greet}</p>
            <h1 style={{ color: P.text, fontSize: 26, fontWeight: 900, lineHeight: 1.15 }}>Document Digitization</h1>
          </div>
          <div style={{ position: 'relative', cursor: 'pointer', marginTop: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${P.mid}, ${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(78,49,170,.5)' }}>
              <Ico n="bell" size={20} color="#fff" />
            </div>
            <div className="badge" style={{ background: '#10b981' }}>3</div>
          </div>
        </div>

        {/* Hero banner */}
        <div className="card-highlight anim-slide-up" style={{ padding: '20px', marginBottom: 20, position: 'relative', overflow: 'hidden', animationDelay: '60ms' }}>
          <div style={{ position: 'absolute', right: -10, top: -10, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, rgba(55,149,189,.25), transparent 70%)` }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(47,88,205,.3)', border: `1px solid rgba(55,149,189,.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className="anim-float">
              <Ico n="zap" size={26} color={P.sky} />
            </div>
            <div>
              <p style={{ color: P.text, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>¡Listo para digitalizar!</p>
              <p style={{ color: P.muted, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>Escanea, extrae texto y genera documentos</p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14, width: '100%', fontSize: 14 }} onClick={() => onNav('scan')}>
            <Ico n="scan" size={17} color="#fff" /> Escanear documento
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }} className="anim-slide-up">
          {[
            { v: '5', l: 'Plantillas', c: '#a78bfa' },
            { v: '24', l: 'Procesados', c: '#10b981' },
            { v: '1.2 GB', l: 'Espacio', c: P.sky },
          ].map((s, i) => (
            <div key={i} className="card-solid" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <p style={{ color: s.c, fontSize: 22, fontWeight: 900, lineHeight: 1 }} className="anim-count-up">{s.v}</p>
              <p style={{ color: P.faint, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Acciones Rápidas</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
          {[
            { icon: 'scan' as const, label: 'Nuevo escaneo', sub: 'Cámara · Captura', tab: 'scan' as Tab, g: `${P.blue}55, ${P.sky}33` },
            { icon: 'doc' as const, label: 'Gestionar plantillas', sub: 'Word · Excel', tab: 'templates' as Tab, g: `${P.mid}99, ${P.blue}55` },
            { icon: 'layers' as const, label: 'Espacio de trabajo', sub: 'Flujo completo', tab: 'workspace' as Tab, g: `${P.sky}55, ${P.mid}66` },
            { icon: 'history' as const, label: 'Historial', sub: '4 acciones recientes', tab: 'home' as Tab, g: `${P.mid}88, ${P.blue}44` },
          ].map((a, i) => (
            <button key={i} className="card" onClick={() => onNav(a.tab)}
              style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, textAlign: 'left', cursor: 'pointer', background: `linear-gradient(135deg, ${a.g})`, border: `1px solid rgba(78,49,170,.35)` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico n={a.icon} size={20} color={P.sky} />
              </div>
              <div>
                <p style={{ color: P.text, fontWeight: 800, fontSize: 14 }}>{a.label}</p>
                <p style={{ color: P.muted, fontSize: 11, marginTop: 2 }}>{a.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Recent documents */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Documentos Recientes</p>
          <button style={{ color: P.sky, fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onNav('workspace')}>Ver todo</button>
        </div>
        <div className="h-scroll">
          {RECENT_DOCS.map(d => (
            <div key={d.id} className="card-solid" style={{ flexShrink: 0, width: 140, padding: '14px 12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: d.type === 'xlsx' ? 'rgba(16,185,129,.15)' : 'rgba(47,88,205,.15)', border: `1px solid ${d.type === 'xlsx' ? 'rgba(16,185,129,.4)' : 'rgba(47,88,205,.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ico n={d.type === 'xlsx' ? 'table' : 'doc'} size={18} color={d.type === 'xlsx' ? '#10b981' : P.sky} />
              </div>
              <p style={{ color: P.text, fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }} className="truncate">{d.name}</p>
              <p style={{ color: P.faint, fontSize: 10, fontFamily: 'DM Mono' }}>{d.type.toUpperCase()} · {d.date}</p>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Actividad</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACTIVITY.map(a => (
            <div key={a.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `${a.color}22`, border: `1px solid ${a.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico n={a.icon} size={18} color={a.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: P.text, fontWeight: 700, fontSize: 13 }}>{a.label}</p>
                <p style={{ color: P.faint, fontSize: 12, marginTop: 1 }}>{a.name}</p>
              </div>
              <span style={{ color: P.faint, fontSize: 11, fontFamily: 'DM Mono', flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TEMPLATES SCREEN ─────────────────────────────────────────────────────────
function TemplatesScreen({ templates, setTemplates, onToast }: { templates: TemplateItem[]; setTemplates: (t: TemplateItem[]) => void; onToast: (m: string) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'Todas' | 'Word' | 'Excel'>('Todas')
  const [selected, setSelected] = useState<TemplateItem | null>(null)

  const visible = templates
    .filter(t => filter === 'Todas' || (filter === 'Word' ? t.type === 'docx' : t.type === 'xlsx'))
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  const star = (id: number) => setTemplates(templates.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
  const del = (id: number) => { setTemplates(templates.filter(t => t.id !== id)); onToast('Plantilla eliminada'); setSelected(null) }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900 }}>Mis Plantillas</h2>
          <span style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 12 }}>{templates.length} plantillas</span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <Ico n="search" size={16} color={P.faint} />
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plantillas…"
            style={{ width: '100%', background: 'rgba(78,49,170,.2)', border: '1px solid rgba(78,49,170,.4)', borderRadius: 14, padding: '11px 14px 11px 38px', color: P.text, fontSize: 14, outline: 'none', fontFamily: 'Outfit' }}
          />
        </div>

        {/* Filter chips */}
        <div className="h-scroll" style={{ marginBottom: 16 }}>
          {(['Todas', 'Word', 'Excel'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-chip ${filter === f ? 'btn-primary' : 'btn-soft'}`} style={{ flexShrink: 0, fontSize: 13 }}>
              {f}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: P.faint }}>
              <Ico n="doc" size={44} color={`${P.mid}80`} />
              <p style={{ marginTop: 12, fontWeight: 600 }}>No hay plantillas. Importa una para comenzar.</p>
            </div>
          )}
          {visible.map((t, i) => (
            <button key={t.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', animationDelay: `${i*40}ms` }}
              onClick={() => setSelected(t)}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: t.type === 'xlsx' ? 'rgba(16,185,129,.12)' : 'rgba(47,88,205,.12)', border: `1px solid ${t.type === 'xlsx' ? 'rgba(16,185,129,.4)' : 'rgba(47,88,205,.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico n={t.type === 'xlsx' ? 'table' : 'doc'} size={20} color={t.type === 'xlsx' ? '#10b981' : P.sky} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <p style={{ color: P.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</p>
                  {t.starred && <Ico n="star" size={13} color="#f59e0b" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="tag" style={{ color: t.type === 'xlsx' ? '#10b981' : P.sky, borderColor: t.type === 'xlsx' ? 'rgba(16,185,129,.4)' : 'rgba(47,88,205,.4)', background: t.type === 'xlsx' ? 'rgba(16,185,129,.1)' : 'rgba(47,88,205,.1)', fontSize: 10 }}>{t.type.toUpperCase()}</span>
                  <span style={{ color: P.faint, fontSize: 11, fontFamily: 'DM Mono' }}>{t.variables.length} variables</span>
                  <span style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>✓ Lista</span>
                </div>
              </div>
              <Ico n="chevron" size={16} color={P.faint} />
            </button>
          ))}
        </div>

        {/* Import FAB */}
        <button className="btn btn-primary" style={{ position: 'fixed', bottom: 100, right: 24, padding: '14px 20px', borderRadius: 18, fontSize: 14, zIndex: 40, boxShadow: '0 8px 28px rgba(47,88,205,.6)' }} onClick={() => onToast('Importar plantilla (próximamente)')}>
          <Ico n="upload" size={17} color="#fff" /> Importar plantilla
        </button>
      </div>

      {/* Template detail sheet */}
      {selected && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelected(null)} />
          <div className="sheet" style={{ padding: '12px 0 36px' }}>
            <div className="sheet-handle" />
            <div style={{ padding: '0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: selected.type === 'xlsx' ? 'rgba(16,185,129,.15)' : 'rgba(47,88,205,.15)', border: `1px solid ${selected.type === 'xlsx' ? 'rgba(16,185,129,.4)' : 'rgba(47,88,205,.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ico n={selected.type === 'xlsx' ? 'table' : 'doc'} size={26} color={selected.type === 'xlsx' ? '#10b981' : P.sky} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: P.text, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{selected.name}</p>
                  <p style={{ color: P.faint, fontSize: 12, marginTop: 3, fontFamily: 'DM Mono' }}>{selected.type.toUpperCase()} · {selected.date}</p>
                </div>
              </div>

              <p style={{ color: P.muted, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Variables ({selected.variables.length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {selected.variables.map(v => (
                  <span key={v} className="tag" style={{ color: P.sky, borderColor: 'rgba(55,149,189,.4)', background: 'rgba(55,149,189,.1)', fontSize: 11, padding: '4px 10px' }}>{`{{${v}}}`}</span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                <button onClick={() => { star(selected.id); setSelected(null) }} className="card-solid" style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
                  <Ico n={selected.starred ? 'star' : 'starOut'} size={20} color="#f59e0b" />
                  <span style={{ color: P.muted, fontSize: 12, fontWeight: 600 }}>{selected.starred ? 'Quitar favorito' : 'Favorito'}</span>
                </button>
                <button onClick={() => del(selected.id)} className="card-solid" style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
                  <Ico n="trash" size={20} color="#fca5a5" />
                  <span style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── SCAN SCREEN ──────────────────────────────────────────────────────────────
function ScanScreen({ onToast, onNav }: { onToast: (m: string) => void; onNav: (t: Tab) => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'perspective' | 'filter' | 'done'>('idle')
  const [prog, setProg] = useState(0)

  const startScan = () => {
    setPhase('scanning'); setProg(0)
    const iv = setInterval(() => setProg(p => {
      if (p >= 100) { clearInterval(iv); setPhase('perspective'); return 100 }
      return p + 2.5
    }), 50)
  }

  useEffect(() => {
    if (phase === 'perspective') {
      const t = setTimeout(() => { setPhase('filter'); setProg(0) }, 1500)
      return () => clearTimeout(t)
    }
    if (phase === 'filter') {
      const iv = setInterval(() => setProg(p => {
        if (p >= 100) { clearInterval(iv); setPhase('done'); return 100 }
        return p + 3
      }), 40)
      return () => clearInterval(iv)
    }
  }, [phase])

  const addToWorkspace = () => { onToast('Documento agregado al workspace'); setPhase('idle'); setProg(0); onNav('workspace') }
  const scanAnother = () => { setPhase('idle'); setProg(0) }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>

        {/* Top nav */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900 }}>Escanear</h2>
          <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>Posiciona el documento en el marco</p>
        </div>

        {/* Viewport */}
        <div className="scan-viewport" style={{ aspectRatio: '3/4', marginBottom: 20 }}>
          <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: .25 }} />
          <div className="scan-corner tl" /><div className="scan-corner tr" />
          <div className="scan-corner bl" /><div className="scan-corner br" />
          {phase === 'scanning' && <div className="scan-beam" />}

          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {phase === 'idle' && (
              <div style={{ textAlign: 'center', opacity: .45 }}>
                <div style={{ width: 60, height: 60, margin: '0 auto 12px' }}><Ico n="scan" size={60} color={P.mid} /></div>
                <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11 }}>LISTO PARA ESCANEAR</p>
              </div>
            )}
            {phase === 'scanning' && (
              <div style={{ textAlign: 'center' }}>
                <div className="anim-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid rgba(55,149,189,.25)`, borderTopColor: P.sky, margin: '0 auto 12px' }} />
                <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>ESCANEANDO… {Math.round(prog)}%</p>
              </div>
            )}
            {phase === 'perspective' && (
              <div style={{ textAlign: 'center' }} className="anim-pop-in">
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(47,88,205,.2)', border: '2px solid rgba(47,88,205,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Ico n="grid" size={24} color={P.sky} />
                </div>
                <p style={{ color: P.sky, fontWeight: 700, fontSize: 14 }}>Corrección de perspectiva</p>
                <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11, marginTop: 4 }}>AJUSTANDO ESQUINAS</p>
              </div>
            )}
            {phase === 'filter' && (
              <div style={{ textAlign: 'center' }}>
                <div className="anim-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid rgba(167,139,250,.25)`, borderTopColor: '#a78bfa', margin: '0 auto 12px' }} />
                <p style={{ color: '#a78bfa', fontFamily: 'DM Mono', fontSize: 12 }}>APLICANDO FILTRO… {Math.round(prog)}%</p>
              </div>
            )}
            {phase === 'done' && (
              <div style={{ textAlign: 'center' }} className="anim-pop-in">
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,.15)', border: '2px solid rgba(16,185,129,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Ico n="check" size={28} color="#10b981" />
                </div>
                <p style={{ color: '#10b981', fontWeight: 800, fontSize: 16 }}>Documento listo</p>
                <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11, marginTop: 4 }}>DIGITALIZADO CON ÉXITO</p>
              </div>
            )}
          </div>

          {(phase === 'scanning' || phase === 'filter') && (
            <div className="prog-track" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, borderRadius: 0 }}>
              <div className="prog-fill" style={{ width: `${prog}%` }} />
            </div>
          )}
        </div>

        {/* Action */}
        {phase === 'idle' && (
          <button onClick={startScan} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 18 }}>
            <Ico n="scan" size={20} color="#fff" /> Escanear
          </button>
        )}
        {(phase === 'scanning' || phase === 'perspective' || phase === 'filter') && (
          <button disabled className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 18, opacity: .6 }}>
            <Ico n="scan" size={20} color="#fff" /> Procesando…
          </button>
        )}
        {phase === 'done' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addToWorkspace} className="btn btn-primary" style={{ flex: 1, padding: '15px', fontSize: 14, borderRadius: 16 }}>
              <Ico n="download" size={18} color="#fff" /> Agregar al workspace
            </button>
            <button onClick={scanAnother} className="btn btn-soft" style={{ padding: '15px 16px', fontSize: 14, borderRadius: 16 }}>
              Escanear otro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── WORKSPACE SCREEN ─────────────────────────────────────────────────────────
const STEP_LABELS = ['Plantilla', 'Páginas', 'Zonas', 'OCR', 'Resultados', 'Generar']

function WorkspaceScreen({ templates, onToast }: { templates: TemplateItem[]; onToast: (m: string) => void }) {
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null)
  const [pages, setPages] = useState<ScannedPage[]>([
    { id: 1, label: 'Página 1', status: 'done' },
    { id: 2, label: 'Página 2', status: 'done' },
  ])
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrDone, setOcrDone] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [genRunning, setGenRunning] = useState(false)
  const [genDone, setGenDone] = useState(false)

  const runOcr = () => {
    setOcrRunning(true); setOcrProgress(0)
    const iv = setInterval(() => setOcrProgress(p => {
      if (p >= 100) { clearInterval(iv); setOcrRunning(false); setOcrDone(true); return 100 }
      return p + 2
    }), 60)
  }

  const runGen = () => {
    setGenRunning(true); setGenProgress(0)
    const iv = setInterval(() => setGenProgress(p => {
      if (p >= 100) { clearInterval(iv); setGenRunning(false); setGenDone(true); return 100 }
      return p + 2.5
    }), 50)
  }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Espacio de Trabajo</h2>
        <p style={{ color: P.faint, fontSize: 12, marginBottom: 16 }}>Flujo de digitalización completo</p>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto' }} className="h-scroll">
          {STEP_LABELS.map((l, i) => (
            <button key={i} onClick={() => {
              if (i === 0 || (i <= step + 1)) setStep(i)
            }}
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono', cursor: 'pointer', border: 'none',
                background: i === step ? 'rgba(47,88,205,.4)' : i < step ? 'rgba(16,185,129,.2)' : 'rgba(78,49,170,.2)',
                color: i === step ? '#fff' : i < step ? '#10b981' : P.faint,
              }}>
              {i < step ? '✓ ' : ''}{l}
            </button>
          ))}
        </div>

        {/* Step 0: Seleccionar Plantilla */}
        {step === 0 && (
          <div className="anim-slide-up">
            <p style={{ color: P.muted, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Selecciona una plantilla para comenzar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {templates.map(t => (
                <button key={t.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: selectedTemplate?.id === t.id ? '2px solid rgba(55,149,189,.8)' : undefined }}
                  onClick={() => setSelectedTemplate(t)}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: t.type === 'xlsx' ? 'rgba(16,185,129,.12)' : 'rgba(47,88,205,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ico n={t.type === 'xlsx' ? 'table' : 'doc'} size={20} color={t.type === 'xlsx' ? '#10b981' : P.sky} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: P.text, fontWeight: 700, fontSize: 14 }}>{t.name}</p>
                    <p style={{ color: P.faint, fontSize: 11 }}>{t.type.toUpperCase()} · {t.variables.length} variables</p>
                  </div>
                  {selectedTemplate?.id === t.id && <Ico n="check" size={20} color={P.sky} />}
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: P.muted, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Variables detectadas</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedTemplate.variables.map(v => (
                    <span key={v} className="tag" style={{ color: P.sky, borderColor: 'rgba(55,149,189,.4)', background: 'rgba(55,149,189,.1)', fontSize: 11, padding: '4px 10px' }}>{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setStep(1)} disabled={!selectedTemplate} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, opacity: selectedTemplate ? 1 : .5 }}>
              Iniciar workspace
            </button>
          </div>
        )}

        {/* Step 1: Páginas */}
        {step === 1 && (
          <div className="anim-slide-up">
            <p style={{ color: P.muted, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Agrega documentos escaneados</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn btn-soft" style={{ flex: 1, padding: '14px' }} onClick={() => { setPages([...pages, { id: pages.length+1, label: `Página ${pages.length+1}`, status: 'pending' }]); onToast('Página agregada') }}>
                <Ico n="camera" size={18} color={P.sky} /> Cámara
              </button>
              <button className="btn btn-soft" style={{ flex: 1, padding: '14px' }} onClick={() => { setPages([...pages, { id: pages.length+1, label: `Página ${pages.length+1}`, status: 'done' }]); onToast('Imagen importada') }}>
                <Ico n="photo" size={18} color={P.sky} /> Galería
              </button>
            </div>

            <p style={{ color: P.muted, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Páginas ({pages.length})</p>
            <div className="h-scroll" style={{ marginBottom: 20 }}>
              {pages.map(pg => (
                <div key={pg.id} className="card-solid" style={{ flexShrink: 0, width: 100, padding: '12px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 60, borderRadius: 8, background: 'rgba(78,49,170,.3)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico n="doc" size={20} color={P.faint} />
                  </div>
                  <p style={{ color: P.text, fontSize: 11, fontWeight: 600 }}>{pg.label}</p>
                  <span style={{ color: pg.status === 'done' ? '#10b981' : '#f59e0b', fontSize: 10 }}>{pg.status === 'done' ? '✓ Lista' : '⏳ Pendiente'}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} className="btn btn-soft" style={{ padding: '14px 18px', borderRadius: 14 }}>Anterior</button>
              <button onClick={() => setStep(2)} className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14 }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 2: Zonas */}
        {step === 2 && (
          <div className="anim-slide-up">
            <p style={{ color: P.muted, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Define zonas de interés sobre el documento</p>

            {/* Toolbar */}
            <div className="h-scroll" style={{ marginBottom: 12 }}>
              {['Orientación', 'Propagar', 'Deshacer', 'Rehacer', 'Eliminar'].map(btn => (
                <button key={btn} className="btn btn-soft" style={{ flexShrink: 0, padding: '8px 12px', fontSize: 12 }}>{btn}</button>
              ))}
            </div>

            {/* Image viewport placeholder */}
            <div style={{ width: '100%', aspectRatio: '4/5', borderRadius: 16, background: 'rgba(20,6,50,.8)', border: '1px solid rgba(78,49,170,.4)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: .15 }} />
              <div style={{ textAlign: 'center', opacity: .5 }}>
                <Ico n="grid" size={40} color={P.mid} />
                <p style={{ color: P.faint, fontSize: 11, fontFamily: 'DM Mono', marginTop: 8 }}>ÁREA DE DIBUJO</p>
              </div>
            </div>

            <p style={{ color: P.faint, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>Doble-tap + arrastrar para dibujar zona</p>

            {/* Zone chips */}
            {selectedTemplate && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {selectedTemplate.variables.map((v, i) => {
                  const colors = ['#3795BD', '#a78bfa', '#10b981', '#f59e0b', '#ef4444']
                  const c = colors[i % colors.length]
                  return <span key={v} className="tag" style={{ color: c, borderColor: `${c}55`, background: `${c}15`, fontSize: 11, padding: '4px 10px' }}>{v}</span>
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} className="btn btn-soft" style={{ padding: '14px 18px', borderRadius: 14 }}>Anterior</button>
              <button onClick={() => setStep(3)} className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14 }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 3: OCR */}
        {step === 3 && (
          <div className="anim-slide-up">
            <p style={{ color: P.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Procesamiento OCR</p>
            <p style={{ color: P.faint, fontSize: 12, marginBottom: 16 }}>Extrae texto de las zonas definidas</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {pages.map(pg => (
                <div key={pg.id} className="card-solid" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: ocrDone ? 'rgba(16,185,129,.15)' : 'rgba(78,49,170,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ocrDone ? <Ico n="check" size={16} color="#10b981" /> : <Ico n="doc" size={16} color={P.faint} />}
                  </div>
                  <p style={{ color: P.text, fontWeight: 600, fontSize: 13, flex: 1 }}>{pg.label}</p>
                  <span style={{ color: ocrDone ? '#10b981' : ocrRunning ? P.sky : P.faint, fontSize: 11, fontFamily: 'DM Mono' }}>
                    {ocrDone ? 'Listo' : ocrRunning ? 'Procesando' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>

            {ocrRunning && (
              <div className="card-solid anim-slide-up" style={{ padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>Procesando OCR</span>
                  <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>{Math.round(ocrProgress)}%</span>
                </div>
                <div className="prog-track" style={{ height: 6 }}>
                  <div className="prog-fill" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {!ocrDone && (
              <button onClick={runOcr} disabled={ocrRunning} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, opacity: ocrRunning ? .6 : 1, marginBottom: 12 }}>
                <Ico n="eye" size={18} color="#fff" /> {ocrRunning ? 'Procesando…' : 'Procesar OCR'}
              </button>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} className="btn btn-soft" style={{ padding: '14px 18px', borderRadius: 14 }}>Anterior</button>
              <button onClick={() => setStep(4)} disabled={!ocrDone} className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14, opacity: ocrDone ? 1 : .5 }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 4: Resultados */}
        {step === 4 && (
          <div className="anim-slide-up">
            <p style={{ color: P.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Resultados OCR</p>
            <p style={{ color: P.faint, fontSize: 12, marginBottom: 16 }}>Revisa y edita el texto extraído</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(selectedTemplate?.variables ?? ['nombre', 'edad', 'club']).map((v, i) => {
                const confidence = [95, 88, 72, 91, 85][i % 5]
                const confColor = confidence > 90 ? '#10b981' : confidence > 80 ? '#f59e0b' : '#ef4444'
                const mockValues = ['Juan Pérez', '28', 'Club Atlético', 'Defensa', '15/03/2024']
                return (
                  <div key={v} className="card-solid" style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: P.sky, fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono' }}>{`{{${v}}}`}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: confColor, display: 'inline-block' }} />
                        <span style={{ color: confColor, fontSize: 11, fontFamily: 'DM Mono' }}>{confidence}%</span>
                      </div>
                    </div>
                    <input defaultValue={mockValues[i % mockValues.length]}
                      style={{ width: '100%', background: 'rgba(78,49,170,.15)', border: '1px solid rgba(78,49,170,.3)', borderRadius: 10, padding: '10px 12px', color: P.text, fontSize: 14, outline: 'none', fontFamily: 'Outfit' }}
                    />
                  </div>
                )
              })}
            </div>

            <button onClick={() => onToast('Resultados guardados')} className="btn btn-soft" style={{ width: '100%', padding: '13px', borderRadius: 14, marginBottom: 12 }}>
              <Ico n="check" size={16} color={P.sky} /> Guardar
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} className="btn btn-soft" style={{ padding: '14px 18px', borderRadius: 14 }}>Anterior</button>
              <button onClick={() => setStep(5)} className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: 14 }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* Step 5: Generar */}
        {step === 5 && (
          <div className="anim-slide-up">
            <p style={{ color: P.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Generar Documentos</p>
            <p style={{ color: P.faint, fontSize: 12, marginBottom: 16 }}>Genera los archivos finales con los datos extraídos</p>

            <div className="card-solid" style={{ padding: '16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Ico n={selectedTemplate?.type === 'xlsx' ? 'table' : 'doc'} size={20} color={P.sky} />
                <div>
                  <p style={{ color: P.text, fontWeight: 700, fontSize: 14 }}>{selectedTemplate?.name ?? 'Plantilla'}</p>
                  <p style={{ color: P.faint, fontSize: 11 }}>{selectedTemplate?.type.toUpperCase()} · {selectedTemplate?.variables.length ?? 0} variables</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(78,49,170,.2)' }}>
                <span style={{ color: P.faint, fontSize: 12 }}>Registros a generar</span>
                <span style={{ color: P.text, fontWeight: 700, fontSize: 13 }}>{pages.length}</span>
              </div>
            </div>

            {genRunning && (
              <div className="card-solid anim-slide-up" style={{ padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>Generando documentos</span>
                  <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>{Math.round(genProgress)}%</span>
                </div>
                <div className="prog-track" style={{ height: 6 }}>
                  <div className="prog-fill" style={{ width: `${genProgress}%` }} />
                </div>
              </div>
            )}

            {genDone && (
              <div className="card-highlight anim-pop-in" style={{ padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico n="check" size={22} color="#10b981" />
                  </div>
                  <div>
                    <p style={{ color: P.text, fontWeight: 800, fontSize: 15 }}>¡Documentos generados!</p>
                    <p style={{ color: P.faint, fontSize: 11 }}>{pages.length} archivos listos</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pages.map(pg => (
                    <div key={pg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(78,49,170,.2)' }}>
                      <span style={{ color: P.text, fontSize: 13 }}>{selectedTemplate?.name}_{pg.id}.{selectedTemplate?.type}</span>
                      <button className="btn btn-soft" style={{ padding: '6px 12px', fontSize: 11 }}>
                        <Ico n="share" size={14} color={P.sky} /> Compartir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!genDone && (
              <button onClick={runGen} disabled={genRunning} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, opacity: genRunning ? .6 : 1, marginBottom: 12 }}>
                <Ico n="zap" size={18} color="#fff" /> {genRunning ? 'Generando…' : 'Generar lote'}
              </button>
            )}

            {genDone && (
              <button onClick={() => onToast('ZIP compartido (próximamente)')} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, marginBottom: 12 }}>
                <Ico n="share" size={18} color="#fff" /> Compartir ZIP
              </button>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(4)} className="btn btn-soft" style={{ padding: '14px 18px', borderRadius: 14 }}>Anterior</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ onToast }: { onToast: (m: string) => void }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const storageItems = [
    { label: 'Plantillas', used: 0.3, total: 2, color: '#a78bfa' },
    { label: 'Fuentes (escaneos)', used: 0.8, total: 5, color: P.sky },
    { label: 'Generados', used: 0.1, total: 2, color: '#10b981' },
  ]

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900, marginBottom: 20 }}>Ajustes</h2>

        {/* Storage section */}
        <div className="card-solid" style={{ padding: '16px', marginBottom: 16 }}>
          <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 11, marginBottom: 14 }}>ALMACENAMIENTO</p>
          {storageItems.map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: P.text, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                <span style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 12 }}>{s.used} / {s.total} GB</span>
              </div>
              <div className="prog-track" style={{ height: 6 }}>
                <div style={{ width: `${(s.used/s.total)*100}%`, height: '100%', background: s.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(78,49,170,.2)' }}>
            <span style={{ color: P.text, fontSize: 13, fontWeight: 700 }}>Total usado</span>
            <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700 }}>1.2 / 9 GB</span>
          </div>
        </div>

        <button onClick={() => setShowConfirm(true)} className="btn btn-soft" style={{ width: '100%', padding: '14px', borderRadius: 14, marginBottom: 20 }}>
          <Ico n="trash" size={16} color={P.muted} /> Liberar espacio
        </button>

        {/* App info */}
        <div className="card-solid" style={{ padding: '16px', marginBottom: 16 }}>
          <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 11, marginBottom: 14 }}>INFORMACIÓN</p>
          {[
            { l: 'Aplicación', v: 'Document Digitization' },
            { l: 'Versión', v: '1.0.0' },
            { l: 'Plataforma', v: 'App Móvil' },
            { l: 'Idioma', v: 'Español' },
          ].map(item => (
            <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(78,49,170,.15)' }}>
              <span style={{ color: P.muted, fontSize: 13 }}>{item.l}</span>
              <span style={{ color: P.text, fontSize: 13, fontWeight: 600 }}>{item.v}</span>
            </div>
          ))}
        </div>

        {/* Theme toggle */}
        <div className="card-solid" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: P.text, fontWeight: 700, fontSize: 14 }}>Tema oscuro</p>
              <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>Apariencia de la aplicación</p>
            </div>
            <ToggleBtn defaultOn={true} />
          </div>
        </div>
      </div>

      {/* Confirmation sheet */}
      {showConfirm && (
        <>
          <div className="sheet-backdrop" onClick={() => setShowConfirm(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '0 20px' }}>
              <p style={{ color: P.text, fontWeight: 900, fontSize: 18, marginBottom: 8 }}>¿Liberar espacio?</p>
              <p style={{ color: P.faint, fontSize: 13, marginBottom: 20 }}>Se eliminarán archivos generados y escaneos antiguos. Las plantillas se mantendrán.</p>
              <button onClick={() => { setShowConfirm(false); onToast('Espacio liberado') }} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, marginBottom: 10 }}>
                Confirmar
              </button>
              <button onClick={() => setShowConfirm(false)} className="btn btn-soft" style={{ width: '100%', padding: '14px', fontSize: 14, borderRadius: 14 }}>
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── TAB BAR ──────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="tab-bar">
      {/* Inicio */}
      <div className={`tab-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
        <div className="tab-icon-wrap">
          <Ico n="home" size={22} color={tab === 'home' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'home' ? '#fff' : 'rgba(196,181,244,.45)' }}>Inicio</span>
      </div>

      {/* Plantillas */}
      <div className={`tab-item ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
        <div className="tab-icon-wrap">
          <Ico n="doc" size={22} color={tab === 'templates' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'templates' ? '#fff' : 'rgba(196,181,244,.45)' }}>Plantillas</span>
      </div>

      {/* FAB — center scan button */}
      <div className="tab-fab" onClick={() => setTab('scan')}>
        <div className={`fab-btn ${tab === 'scan' ? 'pulse-ring' : ''}`} style={{ position: 'relative' }}>
          <Ico n="scan" size={26} color="#fff" />
        </div>
        <span className="tab-label" style={{ color: tab === 'scan' ? P.sky : 'rgba(196,181,244,.45)', marginTop: 2 }}>Escanear</span>
      </div>

      {/* Workspace */}
      <div className={`tab-item ${tab === 'workspace' ? 'active' : ''}`} onClick={() => setTab('workspace')}>
        <div className="tab-icon-wrap">
          <Ico n="layers" size={22} color={tab === 'workspace' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'workspace' ? '#fff' : 'rgba(196,181,244,.45)' }}>Workspace</span>
      </div>

      {/* Ajustes */}
      <div className={`tab-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
        <div className="tab-icon-wrap">
          <Ico n="settings" size={22} color={tab === 'settings' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'settings' ? '#fff' : 'rgba(196,181,244,.45)' }}>Ajustes</span>
      </div>
    </div>
  )
}

// ── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [templates, setTemplates] = useState<TemplateItem[]>(TEMPLATES)
  const [toast, setToast] = useState<string | null>(null)
  const [navCount, setNavCount] = useState(0)
  const showToast = useCallback((m: string) => setToast(m), [])

  const handleSetTab = useCallback((t: Tab) => {
    setTab(t)
    setNavCount(c => c + 1)
  }, [])

  return (
    <div className="phone-wrap">
      <div className="phone-frame">
        <div className="screen">
          <StatusBar />

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {tab === 'home'      && <div key={`home-${navCount}`} className="anim-slide-up" style={{ height: '100%' }}><HomeScreen onNav={handleSetTab} /></div>}
            {tab === 'templates' && <div key={`templates-${navCount}`} className="anim-slide-up" style={{ height: '100%' }}><TemplatesScreen templates={templates} setTemplates={setTemplates} onToast={showToast} /></div>}
            {tab === 'scan'      && <ScanScreen onToast={showToast} onNav={handleSetTab} />}
            {tab === 'workspace' && <div key={`workspace-${navCount}`} className="anim-slide-up" style={{ height: '100%' }}><WorkspaceScreen templates={templates} onToast={showToast} /></div>}
            {tab === 'settings'  && <div key={`settings-${navCount}`} className="anim-slide-up" style={{ height: '100%' }}><SettingsScreen onToast={showToast} /></div>}

            {/* Toast */}
            {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
          </div>

          <TabBar tab={tab} setTab={handleSetTab} />
        </div>
      </div>
    </div>
  )
}
