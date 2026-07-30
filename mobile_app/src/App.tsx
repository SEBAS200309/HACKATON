import { useState, useEffect, useRef, useCallback } from 'react'

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
}

function Ico({ n, size = 20, color = 'currentColor' }: { n: keyof typeof Ic; size?: number; color?: string }) {
  return <span style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, color }}>{Ic[n]}</span>
}

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'scan' | 'files' | 'convert' | 'settings'

type FileItem = {
  id: number; name: string; ext: string; size: string; date: string
  status: 'done' | 'processing' | 'queued'; progress: number; starred: boolean
  color: string
}

// ── Data ────────────────────────────────────────────────────────────────────
const FILES: FileItem[] = [
  { id: 1, name: 'Contract Q4', ext: 'PDF', size: '2.4 MB', date: 'Jul 28', status: 'done', progress: 100, starred: true, color: '#ef4444' },
  { id: 2, name: 'Invoice 0847', ext: 'JPG', size: '1.1 MB', date: 'Jul 28', status: 'done', progress: 100, starred: false, color: P.sky },
  { id: 3, name: 'Research Draft', ext: 'DOCX', size: '856 KB', date: 'Jul 29', status: 'processing', progress: 64, starred: false, color: '#f59e0b' },
  { id: 4, name: 'Product Catalog', ext: 'PDF', size: '8.2 MB', date: 'Jul 30', status: 'queued', progress: 0, starred: false, color: '#ef4444' },
  { id: 5, name: 'Meeting Notes', ext: 'PNG', size: '540 KB', date: 'Jul 27', status: 'done', progress: 100, starred: true, color: '#10b981' },
  { id: 6, name: 'Annual Report', ext: 'PDF', size: '4.7 MB', date: 'Jul 25', status: 'done', progress: 100, starred: false, color: '#ef4444' },
]

const ACTIVITY = [
  { id: 1, label: 'Scanned', name: 'Passport copy', time: '2h ago', icon: 'scan' as const, color: P.sky },
  { id: 2, label: 'Converted', name: 'Invoice → PDF', time: '5h ago', icon: 'convert' as const, color: P.blue },
  { id: 3, label: 'Uploaded', name: 'Contract.pdf', time: 'Yesterday', icon: 'upload' as const, color: '#a78bfa' },
  { id: 4, label: 'Shared', name: 'Research draft', time: 'Jul 28', icon: 'share' as const, color: '#10b981' },
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

// ── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ onNav, files }: { onNav: (t: Tab) => void; files: FileItem[] }) {
  const hour = new Date().getHours()
  const greet = hour < 12 ? '☀️  Good morning' : hour < 18 ? '👋  Good afternoon' : '🌙  Good evening'
  const processing = files.filter(f => f.status === 'processing').length
  const done = files.filter(f => f.status === 'done').length

  return (
    <div className="page-scroll">
      <div style={{ padding: '8px 20px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }} className="anim-slide-up">
          <div>
            <p style={{ color: P.muted, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{greet}</p>
            <h1 style={{ color: P.text, fontSize: 26, fontWeight: 900, lineHeight: 1.15 }}>Alex Rivera</h1>
          </div>
          <div style={{ position: 'relative', cursor: 'pointer', marginTop: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${P.mid}, ${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(78,49,170,.5)' }}>
              <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 17, color: '#fff' }}>AR</span>
            </div>
            <div className="badge" style={{ background: '#10b981' }}>2</div>
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
              <p style={{ color: P.text, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>Ready to digitize!</p>
              <p style={{ color: P.muted, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>
                {processing > 0 ? `${processing} file processing · ${done} ready` : `${done} files ready · All systems go`}
              </p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14, width: '100%', fontSize: 14 }} onClick={() => onNav('scan')}>
            <Ico n="scan" size={17} color="#fff" /> Scan a Document
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }} className="anim-slide-up" >
          {[
            { v: done.toString(), l: 'Digitized', c: '#10b981' },
            { v: processing.toString(), l: 'Processing', c: P.sky },
            { v: '34 GB', l: 'Saved', c: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} className="card-solid" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <p style={{ color: s.c, fontSize: 22, fontWeight: 900, lineHeight: 1 }} className="anim-count-up">{s.v}</p>
              <p style={{ color: P.faint, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Quick Actions</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
          {[
            { icon: 'scan' as const, label: 'New Scan', sub: 'Camera · Scanner', tab: 'scan' as Tab, g: `${P.blue}55, ${P.sky}33` },
            { icon: 'convert' as const, label: 'Convert', sub: 'PDF · DOCX · more', tab: 'convert' as Tab, g: `${P.mid}99, ${P.blue}55` },
            { icon: 'upload' as const, label: 'Upload', sub: 'Device · Cloud', tab: 'files' as Tab, g: `${P.sky}55, ${P.mid}66` },
            { icon: 'history' as const, label: 'Activity', sub: '4 recent actions', tab: 'files' as Tab, g: `${P.mid}88, ${P.blue}44` },
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

        {/* Recent files */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Recent Files</p>
          <button style={{ color: P.sky, fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onNav('files')}>See all</button>
        </div>
        <div className="h-scroll">
          {FILES.slice(0,4).map(f => (
            <div key={f.id} className="card-solid" style={{ flexShrink: 0, width: 140, padding: '14px 12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${f.color}22`, border: `1px solid ${f.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ico n={f.ext === 'JPG' || f.ext === 'PNG' ? 'photo' : 'doc'} size={18} color={f.color} />
              </div>
              <p style={{ color: P.text, fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }} className="truncate">{f.name}</p>
              <p style={{ color: P.faint, fontSize: 10, fontFamily: 'DM Mono' }}>{f.ext} · {f.size}</p>
              {f.status === 'processing' && (
                <div className="prog-track" style={{ height: 3, marginTop: 8 }}>
                  <div className="prog-fill" style={{ width: `${f.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <p style={{ color: P.muted, fontSize: 13, fontWeight: 700, margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '.06em' }} className="mono">Activity</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACTIVITY.map((a, i) => (
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

// ── SCAN SCREEN ──────────────────────────────────────────────────────────────
function ScanScreen({ onToast }: { onToast: (m: string) => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [prog, setProg] = useState(0)
  const [mode, setMode] = useState<'color' | 'gray' | 'bw'>('color')
  const [showSheet, setShowSheet] = useState(false)

  const startScan = () => {
    setPhase('scanning'); setProg(0)
    const iv = setInterval(() => setProg(p => {
      if (p >= 100) { clearInterval(iv); setPhase('done'); return 100 }
      return p + 1.8
    }), 50)
  }

  const save = () => { onToast('File saved to My Files!'); setPhase('idle'); setProg(0) }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>

        {/* Top nav row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900 }}>Scan</h2>
            <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>Position document in frame</p>
          </div>
          <button className="btn-ghost btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setShowSheet(true)}>
            Options
          </button>
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
                <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11 }}>READY TO SCAN</p>
              </div>
            )}
            {phase === 'scanning' && (
              <div style={{ textAlign: 'center' }}>
                <div className="anim-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid rgba(55,149,189,.25)`, borderTopColor: P.sky, margin: '0 auto 12px' }} />
                <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>SCANNING… {Math.round(prog)}%</p>
              </div>
            )}
            {phase === 'done' && (
              <div style={{ textAlign: 'center' }} className="anim-pop-in">
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,.15)', border: '2px solid rgba(16,185,129,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Ico n="check" size={28} color="#10b981" />
                </div>
                <p style={{ color: '#10b981', fontWeight: 800, fontSize: 16 }}>Scan Complete!</p>
                <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11, marginTop: 4 }}>DOCUMENT DIGITIZED</p>
              </div>
            )}
          </div>

          {phase === 'scanning' && (
            <div className="prog-track" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, borderRadius: 0 }}>
              <div className="prog-fill" style={{ width: `${prog}%` }} />
            </div>
          )}
        </div>

        {/* Mode pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['color', 'gray', 'bw'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`btn btn-chip flex-1 ${mode === m ? 'btn-primary' : 'btn-soft'}`} style={{ fontSize: 13 }}>
              {m === 'color' ? '🎨 Color' : m === 'gray' ? '🌫 Gray' : '⬛ B&W'}
            </button>
          ))}
        </div>

        {/* Action */}
        {phase !== 'done' ? (
          <button onClick={startScan} disabled={phase === 'scanning'} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 18, opacity: phase === 'scanning' ? .6 : 1 }}>
            <Ico n="scan" size={20} color="#fff" />
            {phase === 'scanning' ? 'Scanning…' : 'Start Scan'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} className="btn btn-primary" style={{ flex: 1, padding: '15px', fontSize: 15, borderRadius: 16 }}>
              <Ico n="download" size={18} color="#fff" /> Save File
            </button>
            <button onClick={() => { setPhase('idle'); setProg(0) }} className="btn btn-soft" style={{ padding: '15px 18px', fontSize: 14, borderRadius: 16 }}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Options bottom sheet */}
      {showSheet && (
        <>
          <div className="sheet-backdrop" onClick={() => setShowSheet(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ padding: '0 20px' }}>
              <p style={{ color: P.text, fontWeight: 900, fontSize: 18, marginBottom: 20 }}>Scan Options</p>
              {[
                { l: 'Auto-crop edges', s: 'Detect document bounds automatically', on: true },
                { l: 'AI Enhancement', s: 'Improve sharpness and contrast', on: true },
                { l: 'Multi-page scan', s: 'Combine pages into one file', on: false },
              ].map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                  <div>
                    <p style={{ color: P.text, fontWeight: 700, fontSize: 15 }}>{o.l}</p>
                    <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>{o.s}</p>
                  </div>
                  <ToggleBtn defaultOn={o.on} />
                </div>
              ))}
              <button onClick={() => setShowSheet(false)} className="btn btn-primary" style={{ width: '100%', padding: '15px', fontSize: 15, borderRadius: 16, marginTop: 4 }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
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

// ── FILES SCREEN ─────────────────────────────────────────────────────────────
function FilesScreen({ files, setFiles, onToast }: { files: FileItem[]; setFiles: (f: FileItem[]) => void; onToast: (m: string) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'All' | 'PDF' | 'Image' | 'DOCX'>('All')
  const [selected, setSelected] = useState<FileItem | null>(null)

  const visible = files
    .filter(f => filter === 'All' || (filter === 'Image' ? ['JPG','PNG'].includes(f.ext) : f.ext === filter))
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const star = (id: number) => setFiles(files.map(f => f.id === id ? { ...f, starred: !f.starred } : f))
  const del  = (id: number) => { setFiles(files.filter(f => f.id !== id)); onToast('File deleted'); setSelected(null) }

  const statusMeta: Record<string, { label: string; color: string }> = {
    done:       { label: 'Ready',      color: '#10b981' },
    processing: { label: 'Processing', color: P.sky },
    queued:     { label: 'Queued',     color: '#f59e0b' },
  }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900 }}>My Files</h2>
          <span style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 12 }}>{files.length} docs</span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <Ico n="search" size={16} color={P.faint} />
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…"
            style={{ width: '100%', background: 'rgba(78,49,170,.2)', border: '1px solid rgba(78,49,170,.4)', borderRadius: 14, padding: '11px 14px 11px 38px', color: P.text, fontSize: 14, outline: 'none', fontFamily: 'Outfit' }}
          />
        </div>

        {/* Filter chips */}
        <div className="h-scroll" style={{ marginBottom: 16 }}>
          {(['All','PDF','Image','DOCX'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-chip ${filter === f ? 'btn-primary' : 'btn-soft'}`} style={{ flexShrink: 0, fontSize: 13 }}>
              {f}
            </button>
          ))}
        </div>

        {/* File list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: P.faint }}>
              <Ico n="files" size={44} color={`${P.mid}80`} />
              <p style={{ marginTop: 12, fontWeight: 600 }}>No files found</p>
            </div>
          )}
          {visible.map((f, i) => (
            <button key={f.id} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', animationDelay: `${i*40}ms` }}
              onClick={() => setSelected(f)}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: `${f.color}22`, border: `1px solid ${f.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico n={['JPG','PNG'].includes(f.ext) ? 'photo' : 'doc'} size={20} color={f.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <p style={{ color: P.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</p>
                  {f.starred && <Ico n="star" size={13} color="#f59e0b" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="tag" style={{ color: f.color, borderColor: `${f.color}44`, background: `${f.color}15`, fontSize: 10 }}>{f.ext}</span>
                  <span className="tag" style={{ color: statusMeta[f.status].color, borderColor: `${statusMeta[f.status].color}44`, background: `${statusMeta[f.status].color}15`, fontSize: 10 }}>
                    {f.status === 'processing' && <span className="anim-blink" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', marginRight: 4, verticalAlign: 'middle' }} />}
                    {statusMeta[f.status].label}
                  </span>
                  <span style={{ color: P.faint, fontSize: 11, fontFamily: 'DM Mono' }}>{f.size}</span>
                </div>
                {f.status === 'processing' && (
                  <div className="prog-track" style={{ height: 3, marginTop: 8 }}>
                    <div className="prog-fill" style={{ width: `${f.progress}%` }} />
                  </div>
                )}
              </div>
              <Ico n="chevron" size={16} color={P.faint} />
            </button>
          ))}
        </div>
      </div>

      {/* File detail sheet */}
      {selected && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelected(null)} />
          <div className="sheet" style={{ padding: '12px 0 36px' }}>
            <div className="sheet-handle" />
            <div style={{ padding: '0 20px' }}>
              {/* File header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${selected.color}22`, border: `1px solid ${selected.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ico n={['JPG','PNG'].includes(selected.ext) ? 'photo' : 'doc'} size={26} color={selected.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: P.text, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{selected.name}</p>
                  <p style={{ color: P.faint, fontSize: 12, marginTop: 3, fontFamily: 'DM Mono' }}>{selected.ext} · {selected.size} · {selected.date}</p>
                </div>
              </div>

              {/* Actions grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { icon: 'download' as const, label: 'Download', action: () => { onToast('Downloading…'); setSelected(null) } },
                  { icon: 'share' as const, label: 'Share', action: () => { onToast('Share link copied!'); setSelected(null) } },
                  { icon: 'star' as const, label: selected.starred ? 'Unstar' : 'Star', action: () => { star(selected.id); setSelected(null) } },
                ].map((a, i) => (
                  <button key={i} onClick={a.action} className="card-solid" style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(47,88,205,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Ico n={a.icon} size={20} color={P.sky} />
                    </div>
                    <span style={{ color: P.muted, fontSize: 12, fontWeight: 600 }}>{a.label}</span>
                  </button>
                ))}
              </div>

              <button onClick={() => del(selected.id)} className="btn" style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontWeight: 700, fontSize: 14 }}>
                <Ico n="trash" size={17} color="#fca5a5" /> Delete File
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── CONVERT SCREEN ───────────────────────────────────────────────────────────
const FROM_FMT = ['PDF', 'JPG', 'PNG', 'DOCX', 'TIFF']
const TO_FMT   = ['PDF/A', 'DOCX', 'TXT', 'XLSX', 'HTML', 'PNG']

function ConvertScreen({ onToast }: { onToast: (m: string) => void }) {
  const [from, setFrom] = useState('PDF')
  const [to,   setTo]   = useState('DOCX')
  const [ocr,  setOcr]  = useState(true)
  const [qual, setQual] = useState(90)
  const [phase, setPhase] = useState<'idle'|'running'|'done'>('idle')
  const [prog, setProg] = useState(0)

  const run = () => {
    setPhase('running'); setProg(0)
    const iv = setInterval(() => setProg(p => { if (p >= 100) { clearInterval(iv); setPhase('done'); return 100 } return p + 2 }), 50)
  }

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        <h2 style={{ color: P.text, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Convert</h2>
        <p style={{ color: P.faint, fontSize: 13, marginBottom: 20 }}>Choose input and output format</p>

        {/* Format selector */}
        <div className="card-solid" style={{ padding: '18px', marginBottom: 14 }}>
          <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 11, marginBottom: 10 }}>FROM FORMAT</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FROM_FMT.map(f => (
              <button key={f} onClick={() => setFrom(f)} className={`btn btn-chip ${from === f ? 'btn-primary' : 'btn-soft'}`} style={{ fontSize: 13 }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Arrow divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '0 8px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(78,49,170,.35)' }} />
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(47,88,205,.25)', border: `1px solid rgba(47,88,205,.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico n="convert" size={16} color={P.sky} />
          </div>
          <div style={{ flex: 1, height: 1, background: 'rgba(78,49,170,.35)' }} />
        </div>

        <div className="card-solid" style={{ padding: '18px', marginBottom: 14 }}>
          <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 11, marginBottom: 10 }}>TO FORMAT</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TO_FMT.map(f => (
              <button key={f} onClick={() => setTo(f)} className={`btn btn-chip ${to === f ? 'btn-primary' : 'btn-soft'}`} style={{ fontSize: 13 }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="card-solid" style={{ padding: '18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <p style={{ color: P.text, fontWeight: 700, fontSize: 15 }}>OCR Processing</p>
              <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>Extract text from images</p>
            </div>
            <div className={`toggle ${ocr ? 'on' : 'off'}`} onClick={() => setOcr(!ocr)}><div className="toggle-knob" /></div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: P.text, fontWeight: 700, fontSize: 15 }}>Quality</p>
              <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 13 }}>{qual}%</span>
            </div>
            <input type="range" min="50" max="100" value={qual} onChange={e => setQual(+e.target.value)}
              className="w-full" style={{ accentColor: P.blue, cursor: 'pointer', height: 20 }} />
          </div>
        </div>

        {/* Progress */}
        {phase === 'running' && (
          <div className="card-solid anim-slide-up" style={{ padding: '14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>Converting {from} → {to}</span>
              <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 12 }}>{Math.round(prog)}%</span>
            </div>
            <div className="prog-track" style={{ height: 8 }}>
              <div className="prog-fill" style={{ width: `${prog}%` }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {phase === 'done' && (
          <div className="card-highlight anim-pop-in" style={{ padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ico n="check" size={22} color="#10b981" />
            </div>
            <div>
              <p style={{ color: P.text, fontWeight: 800, fontSize: 15 }}>Done! File ready.</p>
              <p style={{ color: P.faint, fontFamily: 'DM Mono', fontSize: 11, marginTop: 2 }}>output.{to.toLowerCase().replace('/a','').replace('/','')}</p>
            </div>
          </div>
        )}

        {/* CTA */}
        {phase !== 'done' ? (
          <button onClick={run} disabled={phase === 'running'} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 18, opacity: phase === 'running' ? .6 : 1 }}>
            <Ico n="zap" size={20} color="#fff" />
            {phase === 'running' ? 'Converting…' : `Convert ${from} → ${to}`}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => onToast('File downloaded!')} className="btn btn-primary" style={{ flex: 1, padding: '15px', fontSize: 15, borderRadius: 16 }}>
              <Ico n="download" size={18} color="#fff" /> Download
            </button>
            <button onClick={() => setPhase('idle')} className="btn btn-soft" style={{ padding: '15px 18px', borderRadius: 16 }}>New</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ onToast }: { onToast: (m: string) => void }) {
  const GROUPS = [
    { title: 'Scanning', items: [
      { l: 'Auto-enhance quality', s: 'AI-powered correction', on: true },
      { l: 'Save original file', s: 'Keep source alongside output', on: false },
      { l: 'Auto-detect edges', s: 'Smart document cropping', on: true },
    ]},
    { title: 'Notifications', items: [
      { l: 'Scan complete alerts', s: 'Push notification when done', on: true },
      { l: 'Weekly digest', s: 'Email summary every Monday', on: false },
    ]},
    { title: 'Storage', items: [
      { l: 'Cloud backup', s: 'Auto-sync to cloud', on: true },
      { l: 'Offline mode', s: 'Cache recent files locally', on: false },
    ]},
  ]

  const allDefaults = GROUPS.flatMap(g => g.items.map(i => i.on))
  const [states, setStates] = useState(allDefaults)
  let idx = 0

  return (
    <div className="page-scroll">
      <div style={{ padding: '12px 20px 100px' }}>
        {/* Profile card */}
        <div className="card-highlight" style={{ padding: '18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: `linear-gradient(135deg, ${P.mid}, ${P.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 22, color: '#fff' }}>AR</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: P.text, fontWeight: 800, fontSize: 17 }}>Alex Rivera</p>
            <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>alex@email.com</p>
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>Edit</button>
        </div>

        {/* Storage bar */}
        <div className="card-solid" style={{ padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ color: P.text, fontWeight: 700, fontSize: 14 }}>Storage Used</p>
            <span style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 13 }}>34 / 50 GB</span>
          </div>
          <div className="prog-track" style={{ height: 8 }}>
            <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg, #2F58CD, #3795BD)', borderRadius: 99 }} />
          </div>
          <p style={{ color: P.faint, fontSize: 12, marginTop: 8 }}>68% used · 16 GB remaining</p>
        </div>

        {/* Settings groups */}
        {GROUPS.map(group => (
          <div key={group.title} className="card-solid" style={{ marginBottom: 12 }}>
            <p style={{ color: P.sky, fontFamily: 'DM Mono', fontSize: 11, padding: '14px 16px 8px' }}>{group.title.toUpperCase()}</p>
            {group.items.map((item, j) => {
              const i = idx++
              const isLast = j === group.items.length - 1
              return (
                <div key={item.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: j > 0 ? '1px solid rgba(78,49,170,.2)' : 'none' }}>
                  <div>
                    <p style={{ color: P.text, fontWeight: 600, fontSize: 14 }}>{item.l}</p>
                    <p style={{ color: P.faint, fontSize: 12, marginTop: 2 }}>{item.s}</p>
                  </div>
                  <div className={`toggle ${states[i] ? 'on' : 'off'}`} onClick={() => { const n = [...states]; n[i] = !n[i]; setStates(n); onToast('Saved') }}>
                    <div className="toggle-knob" />
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Sign out */}
        <button className="btn" style={{ width: '100%', padding: '15px', borderRadius: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#fca5a5', fontWeight: 700, fontSize: 15, marginTop: 4 }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ── TAB BAR ──────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; icon: keyof typeof Ic; label: string }[] = [
    { id: 'home',     icon: 'home',     label: 'Home'    },
    { id: 'files',    icon: 'files',    label: 'Files'   },
    { id: 'convert',  icon: 'convert',  label: 'Convert' },
    { id: 'settings', icon: 'settings', label: 'Account' },
  ]

  return (
    <div className="tab-bar">
      {/* Home */}
      <div className={`tab-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
        <div className="tab-icon-wrap">
          <Ico n="home" size={22} color={tab === 'home' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'home' ? '#fff' : 'rgba(196,181,244,.45)' }}>Home</span>
      </div>

      {/* Files */}
      <div className={`tab-item ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>
        <div className="tab-icon-wrap">
          <Ico n="files" size={22} color={tab === 'files' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'files' ? '#fff' : 'rgba(196,181,244,.45)' }}>Files</span>
      </div>

      {/* FAB — center scan button */}
      <div className="tab-fab" onClick={() => setTab('scan')}>
        <div className={`fab-btn ${tab === 'scan' ? 'pulse-ring' : ''}`} style={{ position: 'relative' }}>
          <Ico n="scan" size={26} color="#fff" />
        </div>
        <span className="tab-label" style={{ color: tab === 'scan' ? P.sky : 'rgba(196,181,244,.45)', marginTop: 2 }}>Scan</span>
      </div>

      {/* Convert */}
      <div className={`tab-item ${tab === 'convert' ? 'active' : ''}`} onClick={() => setTab('convert')}>
        <div className="tab-icon-wrap">
          <Ico n="convert" size={22} color={tab === 'convert' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'convert' ? '#fff' : 'rgba(196,181,244,.45)' }}>Convert</span>
      </div>

      {/* Settings */}
      <div className={`tab-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
        <div className="tab-icon-wrap">
          <Ico n="settings" size={22} color={tab === 'settings' ? '#fff' : 'rgba(196,181,244,.5)'} />
        </div>
        <span className="tab-label" style={{ color: tab === 'settings' ? '#fff' : 'rgba(196,181,244,.45)' }}>Account</span>
      </div>
    </div>
  )
}

// ── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [files, setFiles] = useState<FileItem[]>(FILES)
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => setToast(m), [])

  return (
    <div className="phone-wrap">
      <div className="phone-frame">
        <div className="screen">
          <StatusBar />

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {tab === 'home'     && <HomeScreen    onNav={setTab} files={files} />}
            {tab === 'scan'     && <ScanScreen    onToast={showToast} />}
            {tab === 'files'    && <FilesScreen   files={files} setFiles={setFiles} onToast={showToast} />}
            {tab === 'convert'  && <ConvertScreen onToast={showToast} />}
            {tab === 'settings' && <SettingsScreen onToast={showToast} />}

            {/* Toast */}
            {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
          </div>

          <TabBar tab={tab} setTab={setTab} />
        </div>
      </div>
    </div>
  )
}
