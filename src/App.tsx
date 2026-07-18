import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  Box,
  Camera,
  Check,
  ChevronRight,
  CircleGauge,
  GitBranch,
  History,
  Layers3,
  LoaderCircle,
  Paperclip,
  Redo2,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Wind,
  Wrench,
  X,
} from 'lucide-react'
import { VehicleViewport } from './components/VehicleViewport'
import { buildDesignSummary, compileIntent, createInitialSpec, runAgenticLoop, scoreLabels } from './lib/engineering'
import { runDesignTurn } from './lib/designTurn'
import { requestTerraPatch } from './lib/terra'
import { requestStudioRender } from './lib/studioRender'
import { createGeometryReferenceImage } from './lib/vehicleReference'
import { requestVisualCritique, type VisualFidelity } from './lib/visualCritic'
import { createReferenceCatalogCache, formatReferenceResearchSummary, seedReferenceResearch } from './lib/referenceCatalog'
import { buildAeroFlowPlan, type AeroFlowPlan } from './lib/aeroFlow'
import type { ChatMessage, DesignRevision, IterationLog, VehicleSpec, ViewMode } from './types'

const STORAGE_KEY = 'aether-vehicle-studio-v1'
const referenceCatalog = createReferenceCatalogCache({ projectId: 'local-studio' })

type PersistedStudio = {
  history: DesignRevision[]
  activeIndex: number
  messages: ChatMessage[]
}

type ReferenceAttachment = { name: string; dataUrl: string }
type PhotoRender = { revisionId: string; imageDataUrl: string; prompt: string; model?: string; referenceLocked?: boolean; fidelity?: VisualFidelity; retried?: boolean; withheld?: boolean }

const agentNames = ['Intent / Planner', 'Research', 'Vehicle Engineering', 'Geometry', 'Critic', 'Renderer']

function makeSeedRevision(): DesignRevision {
  const seed = createInitialSpec()
  const result = runAgenticLoop(seed)
  return {
    id: 'seed',
    version: 1,
    branch: 'main',
    createdAt: Date.now(),
    prompt: 'Create a balanced electric performance concept.',
    spec: result.spec,
    logs: result.logs,
    summary: buildDesignSummary(result.spec, result.score),
  }
}

function makeIntro(): ChatMessage {
  return {
    id: 'intro',
    role: 'assistant',
    createdAt: Date.now(),
    content: 'Ready to engineer. I infer sensible defaults unless confidence is low, keep the audit trail compact, and generate only vehicle parameters—not raw meshes. Try a vehicle idea, a real-world reference, or a wild combination.',
  }
}

function loadStudio(): PersistedStudio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedStudio
      if (Array.isArray(parsed.history) && parsed.history.length) return parsed
    }
  } catch {
    // A malformed local cache should not stop the studio from starting.
  }
  return { history: [makeSeedRevision()], activeIndex: 0, messages: [makeIntro()] }
}

function shortMetric(value: number, unit: string) {
  return `${value.toFixed(value < 1 ? 2 : 1)}${unit}`
}

function shouldSeedReferenceResearch(prompt: string, referenceCue?: string, hasAttachment = false) {
  if (referenceCue || hasAttachment) return true
  return /\b(?:reference|inspired by|style of|use .{0,80}(?:from|of)|tesla|porsche|ferrari|defender|g[- ]?wagon|cybertruck|f1|formula)\b/i.test(prompt)
}

function LogRow({ log, expanded }: { log: IterationLog; expanded: boolean }) {
  return (
    <div className={`iteration-row ${expanded ? 'expanded' : ''}`}>
      <div className="iteration-index">{String(log.iteration).padStart(2, '0')}</div>
      <div className="iteration-copy">
        <div><span>{log.revision}</span><strong>{log.score}</strong></div>
        <small>{log.issue}</small>
      </div>
      {expanded && (
        <div className="iteration-scores">
          {scoreLabels.map((key) => <span key={key}>{key.slice(0, 4)} <b>{log.scores[key]}</b></span>)}
        </div>
      )}
    </div>
  )
}

function AssistantResponse({ content, spec }: { content: string; spec?: VehicleSpec }) {
  return (
    <article className="message assistant-message">
      <div className="message-icon"><Bot size={14} /></div>
      <div className="message-content">
        <div className="message-meta"><span>AETHER ENGINEER</span><span>NOW</span></div>
        <p>{content}</p>
        {spec && (
          <div className="response-grid">
            <div><small>CHANGED</small><span>{spec.vehicleClass} / {spec.powertrain}</span></div>
            <div><small>TRADE-OFF</small><span>{spec.rearWing > 0.4 ? 'Grip ↔ drag' : 'Efficiency ↔ load'}</span></div>
            <div><small>IMPACT</small><span>{Math.round(spec.downforceBias * 100)}% aero bias</span></div>
          </div>
        )}
      </div>
    </article>
  )
}

function UserMessage({ content }: { content: string }) {
  return <article className="message user-message"><p>{content}</p></article>
}

export default function App() {
  const [{ history, activeIndex, messages }, setStudio] = useState<PersistedStudio>(loadStudio)
  const [prompt, setPrompt] = useState('')
  const [attachment, setAttachment] = useState<ReferenceAttachment | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() => new URLSearchParams(window.location.search).get('view') === 'studio' ? 'studio' : 'solid')
  const [exploded, setExploded] = useState(false)
  const [airflow, setAirflow] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [agentStep, setAgentStep] = useState(0)
  const [showTrace, setShowTrace] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [renderNotice, setRenderNotice] = useState<string | null>(null)
  const [photoRender, setPhotoRender] = useState<PhotoRender | null>(null)
  const [photoRendering, setPhotoRendering] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [aeroPlan, setAeroPlan] = useState<AeroFlowPlan | null>(null)
  const [aeroPlanning, setAeroPlanning] = useState(false)
  const [questionBudget] = useState(0)
  const timerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const aeroRequestRef = useRef(0)

  const active = history[activeIndex] ?? history.at(-1)!
  const finalLog = active.logs.at(-1)!
  const branchCount = new Set(history.map((entry) => entry.branch)).size
  const reference = active.spec.referenceCue
  const liveTerra = import.meta.env.VITE_TERRA_LIVE === 'true'
  const activePhoto = photoRender?.revisionId === active.id ? photoRender : null
  const visiblePhoto = activePhoto && !activePhoto.withheld ? activePhoto : null
  const aeroVisible = airflow && !exploded && viewMode !== 'studio'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, activeIndex, messages }))
  }, [history, activeIndex, messages])

  useEffect(() => {
    const requestId = ++aeroRequestRef.current
    if (!aeroVisible) {
      setAeroPlan(null)
      setAeroPlanning(false)
      return undefined
    }

    setAeroPlan(null)
    setAeroPlanning(true)
    let worker: Worker | null = null
    let settled = false
    const finishWithFallback = () => {
      if (settled || requestId !== aeroRequestRef.current) return
      settled = true
      // A Worker is available in supported browsers. This narrow fallback
      // keeps the estimate usable in constrained local preview environments.
      setAeroPlan(buildAeroFlowPlan(active.spec))
      setAeroPlanning(false)
    }

    try {
      worker = new Worker(new URL('./workers/aeroFlowWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }: MessageEvent<{ id: number; plan?: AeroFlowPlan }>) => {
        if (data.id !== requestId || settled) return
        settled = true
        setAeroPlan(data.plan ?? null)
        setAeroPlanning(false)
      }
      worker.onerror = finishWithFallback
      worker.postMessage({ id: requestId, spec: active.spec })
    } catch {
      finishWithFallback()
    }

    return () => worker?.terminate()
  }, [active.spec, aeroVisible])

  useEffect(() => {
    if (!processing) return undefined
    const id = window.setInterval(() => setAgentStep((step) => Math.min(agentNames.length - 1, step + 1)), 120)
    return () => window.clearInterval(id)
  }, [processing])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        branchDesign()
        return
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === '1') setViewMode('solid')
      if (event.key === '2') setViewMode('wireframe')
      if (event.key === '3') setViewMode('blueprint')
      if (event.key === '4') setViewMode('structural')
      if (event.key.toLowerCase() === 'x') setExploded((value) => !value)
      if (event.key.toLowerCase() === 'a') setAirflow((value) => !value)
      if (event.key.toLowerCase() === 'r') setViewMode('studio')
      if (event.key.toLowerCase() === 'f') setResetToken((value) => value + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // Intentionally attaches current action handlers so shortcuts follow active revision.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, history])

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
  }, [])

  const sceneStatus = useMemo(() => `${active.spec.vehicleClass.toUpperCase()} · ${active.spec.powertrain}`, [active.spec])

  function commitRevision(revision: DesignRevision, nextMessages: ChatMessage[]) {
    setStudio((current) => {
      const ahead = current.history.slice(0, current.activeIndex + 1)
      return { history: [...ahead, revision], activeIndex: ahead.length, messages: nextMessages }
    })
  }

  function submitDesign(event?: React.FormEvent) {
    event?.preventDefault()
    const selectedAttachment = attachment
    const request = prompt.trim() || (selectedAttachment ? 'Adapt this supplied visual reference into the current vehicle.' : '')
    if (!request || processing) return
    setPrompt('')
    setAttachment(null)
    setProcessing(true)
    setAgentStep(0)
    setRenderNotice(null)
    setPhotoRender(null)
    setPhotoError(null)
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: `${request}${selectedAttachment ? `\n↳ Image reference: ${selectedAttachment.name}` : ''}`, createdAt: Date.now() }
    setStudio((current) => ({ ...current, messages: [...current.messages, userMessage] }))
    timerRef.current = window.setTimeout(async () => {
      const compiled = compileIntent(request, active.spec)
      if (selectedAttachment) {
        compiled.referenceCue ??= `User-provided image reference: ${selectedAttachment.name}`
        compiled.assumptions = [...new Set([...compiled.assumptions, 'Visual reference will be adapted for target scale and mounting'])]
      }
      const remotePatch = await requestTerraPatch(request, compiled, selectedAttachment?.dataUrl)
      const result = runDesignTurn(request, active.spec, { remotePatch, referenceImageName: selectedAttachment?.name })
      const referenceResearch = shouldSeedReferenceResearch(request, result.spec.referenceCue, Boolean(selectedAttachment))
        ? seedReferenceResearch({ prompt: request, referenceCue: result.spec.referenceCue, targetSpec: result.spec })
        : undefined
      if (referenceResearch) referenceCatalog.save(referenceResearch)
      const isBranch = activeIndex < history.length - 1
      const branch = isBranch ? `branch-${branchCount + 1}` : active.branch
      const revision: DesignRevision = {
        id: `r-${Date.now()}`,
        version: history.length + 1,
        branch,
        createdAt: Date.now(),
        prompt: request,
        spec: result.spec,
        logs: result.logs,
        referenceResearch,
        summary: buildDesignSummary(result.spec, result.score),
      }
      const referenceSummary = referenceResearch ? formatReferenceResearchSummary(referenceResearch) : ''
      const referenceNote = referenceResearch?.status === 'rejected'
        ? ` Reference guard: ${referenceSummary} The incompatible feature was retained only as research and was not applied.`
        : result.spec.referenceCue
          ? ` Reference adaptation: ${result.spec.referenceCue}; ${referenceSummary || `fit was resized and checked against the ${result.spec.vehicleClass} package`}.`
          : referenceSummary
            ? ` Reference research: ${referenceSummary}`
            : ''
      const answer: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        createdAt: Date.now(),
          content: `${revision.summary}${referenceNote}${remotePatch ? ' Terra supplied the semantic design patch; the local critic then re-scored it.' : ''}`,
      }
      const existing = [...messages, userMessage]
      commitRevision(revision, [...existing, answer])
      setProcessing(false)
      setAgentStep(agentNames.length - 1)
      setResetToken((value) => value + 1)
      setRenderNotice(`v${revision.version} live — ${result.spec.vehicleClass} profile rebuilt`)
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = window.setTimeout(() => setRenderNotice(null), 2800)
    }, 680)
  }

  function chooseReference(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2_000_000) {
      setPrompt((current) => `${current}${current ? ' ' : ''}[Choose an image under 2 MB for visual reference.]`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAttachment({ name: file.name, dataUrl: reader.result })
    }
    reader.readAsDataURL(file)
  }

  async function generateStudioRender() {
    if (photoRendering) return
    setPhotoError(null)
    setPhotoRendering(true)
    try {
      const alignmentReference = createGeometryReferenceImage(active.spec)
      let result = await requestStudioRender(active.spec, alignmentReference)
      let fidelity: VisualFidelity | undefined
      let retried = false
      try {
        fidelity = await requestVisualCritique({ spec: active.spec, alignmentReference, renderedImage: result.imageDataUrl })
        if (!fidelity.pass && fidelity.retryRecommended && fidelity.retryInstruction) {
          result = await requestStudioRender(active.spec, alignmentReference, fidelity.retryInstruction)
          retried = true
          fidelity = await requestVisualCritique({ spec: active.spec, alignmentReference, renderedImage: result.imageDataUrl })
        }
      } catch {
        // A photo remains useful even when the optional visual-review model is unavailable.
      }
      const withheld = Boolean(fidelity && !fidelity.pass)
      setPhotoRender({ revisionId: active.id, ...result, fidelity, retried, withheld })
      if (withheld) {
        setPhotoError(`Photo withheld: ${fidelity?.policyLabel ?? active.spec.vehicleClass} fidelity did not pass after the geometry-locked review. The procedural model remains the source of truth.`)
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Photo render failed')
    } finally {
      setPhotoRendering(false)
    }
  }

  function undo() {
    if (processing || activeIndex === 0) return
    setStudio((current) => ({ ...current, activeIndex: Math.max(0, current.activeIndex - 1) }))
  }

  function redo() {
    if (processing || activeIndex >= history.length - 1) return
    setStudio((current) => ({ ...current, activeIndex: Math.min(current.history.length - 1, current.activeIndex + 1) }))
  }

  function branchDesign() {
    if (processing) return
    const nextBranch = `branch-${branchCount + 1}`
    const clone: DesignRevision = {
      ...active,
      id: `branch-${Date.now()}`,
      version: history.length + 1,
      branch: nextBranch,
      createdAt: Date.now(),
      prompt: `Branch from v${active.version}`,
    }
    const note: ChatMessage = { id: `branch-note-${Date.now()}`, role: 'assistant', createdAt: Date.now(), content: `Created ${nextBranch} from v${active.version}. Future changes stay isolated from ${active.branch}.` }
    commitRevision(clone, [...messages, note])
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /></div>
          <div><strong>AETHER</strong><small>AUTOMOTIVE INTELLIGENCE</small></div>
        </div>
        <div className="project-crumb"><span>PROJECT</span><ChevronRight size={13} /><strong>{active.spec.name}</strong><i>{sceneStatus}</i></div>
        <div className="top-actions">
          <span className="status-pill grounded"><Check size={12} /> PHYSICS GROUNDED</span>
          <span className={`status-pill runtime ${liveTerra ? '' : 'local-runtime'}`}><Sparkles size={12} /> {liveTerra ? 'TERRA LIVE' : 'LOCAL ENGINE'}</span>
          <button className="icon-button" title="Undo (Ctrl/Cmd+Z)" onClick={undo} disabled={activeIndex === 0}><Undo2 size={16} /></button>
          <button className="icon-button" title="Redo (Ctrl/Cmd+Shift+Z)" onClick={redo} disabled={activeIndex === history.length - 1}><Redo2 size={16} /></button>
          <button className="branch-button" onClick={branchDesign}><GitBranch size={15} /> BRANCH</button>
        </div>
      </header>

      <section className="studio-layout">
        <aside className="design-desk">
          <section className="desk-heading">
            <div><span className="eyebrow">DESIGN CONVERSATION</span><h1>What should we engineer?</h1></div>
            <button className="round-icon" title="Conversation settings"><SlidersHorizontal size={16} /></button>
          </section>

          <div className="capability-strip">
            <Sparkles size={15} /><span>Typed design schema only</span><i>NO RAW MESHES</i>
          </div>

          <div className="desk-scroll" aria-label="Conversation and engineering details">
          <section className="conversation" aria-label="Design conversation">
            {messages.map((message) => message.role === 'assistant'
              ? <AssistantResponse key={message.id} content={message.content} spec={message.id.startsWith('a-') ? active.spec : undefined} />
              : <UserMessage key={message.id} content={message.content} />)}
            {processing && (
              <article className="message assistant-message thinking">
                <div className="message-icon"><Bot size={14} /></div>
                <div className="message-content"><div className="message-meta"><span>MULTI-AGENT LOOP</span><span>{liveTerra ? 'TERRA LIVE' : 'LOCAL ENGINE'}</span></div><p>Building a fresh vehicle schema. The previous design is hidden until this revision is ready…</p></div>
              </article>
            )}
          </section>

          <section className="assumptions-card">
            <div className="panel-title"><span><Wrench size={14} /> ACTIVE ASSUMPTIONS</span><small>{questionBudget}/5 QUESTIONS</small></div>
            <div className="assumption-chips">{active.spec.assumptions.slice(0, 3).map((assumption) => <span key={assumption}>{assumption}</span>)}</div>
            {reference && <div className="reference-row"><Search size={13} /><span>{reference}</span><ArrowUpRight size={13} /></div>}
            {active.referenceResearch && <div className="reference-row"><Search size={13} /><span>{formatReferenceResearchSummary(active.referenceResearch)}</span><ArrowUpRight size={13} /></div>}
          </section>

          <section className="agent-panel">
            <div className="panel-title"><span><Activity size={14} /> AGENTIC LOOP</span><small>{processing ? 'RUNNING' : 'COMPLETE'}</small></div>
            <div className="agent-rail">
              {agentNames.map((name, index) => (
                <div key={name} className={`agent-node ${processing && index === agentStep ? 'active' : ''} ${!processing || index < agentStep ? 'done' : ''}`}>
                  <span>{index < 2 ? <Bot size={12} /> : index === 3 ? <Box size={12} /> : <CircleGauge size={12} />}</span><small>{name}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="trace-panel">
            <button className="trace-toggle" onClick={() => setShowTrace((visible) => !visible)}><span><History size={14} /> VALIDATION TRACE</span><span>{active.logs.length} ITERATIONS <ChevronRight size={14} className={showTrace ? 'rotated' : ''} /></span></button>
            <div className="trace-list">
              {active.logs.slice(0, showTrace ? undefined : 2).map((log) => <LogRow key={log.iteration} log={log} expanded={showTrace} />)}
            </div>
          </section>

          </div>

          <form className="composer" onSubmit={submitDesign}>
            <input ref={attachmentInput} className="attachment-input" type="file" accept="image/*" onChange={chooseReference} />
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe a vehicle, reference, or change…" rows={2} />
            {attachment && <div className="attachment-chip"><Paperclip size={12} /><span>{attachment.name}</span><button type="button" aria-label="Remove image reference" onClick={() => setAttachment(null)}><X size={11} /></button></div>}
            <div className="composer-footer"><button className="attach-button" type="button" title="Attach an image reference" onClick={() => attachmentInput.current?.click()}><Paperclip size={14} /></button><span>⌘↵ to run • name, URL, or image</span><button type="submit" aria-label="Run design loop" disabled={(!prompt.trim() && !attachment) || processing}><Send size={16} /></button></div>
          </form>
        </aside>

        <section className={`viewport-workspace ${processing ? 'is-generating' : ''} ${viewMode === 'studio' ? 'is-studio' : ''}`}>
          <VehicleViewport key={active.id} spec={active.spec} viewMode={viewMode} exploded={exploded} airflow={aeroVisible} aeroPlan={aeroPlan} resetToken={resetToken} />
          <div className="viewport-ambient" />
          {viewMode === 'studio' && (
            <div className={`photo-render-layer ${visiblePhoto ? 'has-photo' : ''}`}>
              {visiblePhoto ? (
                <>
                  <img src={visiblePhoto.imageDataUrl} alt={`Photorealistic studio render of ${active.spec.name}`} />
                  {visiblePhoto.fidelity && <div className={`photo-fidelity ${visiblePhoto.fidelity.pass ? 'passing' : 'needs-work'}`}><span>{visiblePhoto.fidelity.policyLabel.toUpperCase()} ALIGNMENT {visiblePhoto.fidelity.score}/100{visiblePhoto.retried ? ' · REFINED' : ''}{visiblePhoto.model ? ` · ${visiblePhoto.model}` : ''}</span><small>{visiblePhoto.fidelity.summary}</small></div>}
                  <button className="photo-regenerate" onClick={generateStudioRender} disabled={photoRendering}><Camera size={13} /> {photoRendering ? 'RENDERING…' : 'RENDER AGAIN'}</button>
                </>
              ) : (
                <div className="photo-render-card">
                  <Camera size={27} />
                  <span>{activePhoto?.withheld ? 'PHOTO WITHHELD · MODEL IS CANONICAL' : 'AI PHOTO RENDER · GEOMETRY LOCK'}</span>
                  <strong>{activePhoto?.withheld ? 'The generated photo drifted from the approved component graph.' : 'Turn this exact revision into a real-car studio image.'}</strong>
                  <small>{activePhoto?.withheld && activePhoto.fidelity ? `${activePhoto.fidelity.policyLabel} alignment stopped at ${activePhoto.fidelity.score}/100 after ${activePhoto.retried ? 'one correction pass' : 'the first review'}. The native procedural model remains visible behind this card.` : liveTerra ? 'A multi-view engineering sheet locks proportions and required systems; the class-aware visual critic can repair major drift before the photo is shown.' : 'Local preview is active. Add a fresh OpenRouter key to .env.local to enable the real-car image generator.'}</small>
                  <button onClick={generateStudioRender} disabled={photoRendering}>{photoRendering ? <><LoaderCircle size={14} /> RENDERING</> : <><Sparkles size={14} /> {activePhoto?.withheld ? 'RETRY FROM MODEL' : 'GENERATE PHOTO RENDER'}</>}</button>
                  {photoError && <em>{photoError}</em>}
                </div>
              )}
            </div>
          )}
          <div className="viewport-topline">
            <div className="mode-ribbon">
              {(['solid', 'wireframe', 'blueprint', 'structural'] as ViewMode[]).map((mode, index) => <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}><kbd>{index + 1}</kbd>{mode}</button>)}
              <button className={viewMode === 'studio' ? 'active' : ''} onClick={() => setViewMode('studio')}><kbd>R</kbd><Camera size={13} /> PHOTO</button>
              <span className="ribbon-divider" />
              <button className={exploded ? 'active' : ''} onClick={() => setExploded((value) => !value)}><kbd>X</kbd><Layers3 size={13} /> EXPLODE</button>
              <button className={airflow ? 'active' : ''} onClick={() => setAirflow((value) => !value)} title="Component-aware aerodynamic estimate, not CFD"><kbd>A</kbd><Wind size={13} /> AERO</button>
            </div>
            <button className="frame-button" onClick={() => setResetToken((value) => value + 1)}><RotateCcw size={14} /> FRAME <kbd>F</kbd></button>
          </div>

          <div className="viewport-hud left-hud">
            <div className="hud-label">{viewMode === 'studio' ? 'PHOTO RENDER / 01' : 'SCENE / 01'}</div>
            <strong>{active.spec.vehicleClass.toUpperCase()} PLATFORM</strong>
            <span>{viewMode === 'studio' ? 'CINEMATIC MATERIAL PREVIEW' : 'PROCEDURAL GEOMETRY'}</span>
          </div>

          {aeroPlan && (
            <aside className="aero-analysis-card" aria-live="polite">
              <div className="aero-analysis-heading"><span>COMPONENT AERO ESTIMATE</span><b>NOT CFD</b></div>
              <strong>{aeroPlan.componentInfluences.length} SYSTEMS <i>â€¢</i> {aeroPlan.streamlines.length} FLOW PATHS</strong>
              <div className="aero-analysis-metrics">
                <span>{aeroPlan.estimate.assumedSpeedKph} KM/H</span>
                <span>DRAG {aeroPlan.estimate.dragIndex}/100</span>
                <span>LOAD {aeroPlan.estimate.downforceIndex}/100</span>
              </div>
              <details className="aero-component-details">
                <summary>INSPECT {aeroPlan.componentInfluences.length} COMPONENT INPUTS</summary>
                <div>
                  {aeroPlan.componentInfluences.map((influence) => <span key={influence.componentId} title={influence.componentId}>{influence.label}<i>{influence.role.replace('-', ' ')}</i></span>)}
                </div>
              </details>
              <small>Schema and component-graph estimate. Final aero decisions require meshed CFD and physical correlation.</small>
            </aside>
          )}
          {aeroVisible && !aeroPlan && aeroPlanning && (
            <aside className="aero-analysis-card" aria-live="polite">
              <div className="aero-analysis-heading"><span>COMPONENT AERO ESTIMATE</span><b>NOT CFD</b></div>
              <strong>TRACING SURFACES...</strong>
              <small>Matching the active body, wheels, aero devices, and cooling surfaces before the live overlay appears.</small>
            </aside>
          )}

          {processing && <div className="generation-overlay"><div className="generation-card"><LoaderCircle size={28} /><span>GENERATING NEW REVISION</span><strong>{agentNames[agentStep]}</strong><small>Previous vehicle is off-stage · schema revision in progress</small></div></div>}
          {renderNotice && !processing && <div className="revision-notice"><Check size={14} /> {renderNotice}</div>}

          <div className="score-strip">
            <div className="overall-score"><span>CONCEPT GATE</span><strong>{finalLog.score}</strong><small>/100</small></div>
            <div className="score-bars">
              {scoreLabels.slice(0, 5).map((label) => <div key={label}><span>{label.slice(0, 4)}</span><i><b style={{ width: `${finalLog.scores[label]}%` }} /></i><em>{finalLog.scores[label]}</em></div>)}
            </div>
          </div>

          <aside className="inspector-card">
            <div className="inspector-title"><span><Box size={14} /> LIVE SPEC</span><small>v{active.version}.{active.branch}</small></div>
            <div className="spec-grid">
              <div><span>WHEELBASE</span><strong>{shortMetric(active.spec.wheelbase, 'm')}</strong></div>
              <div><span>TRACK F/R</span><strong>{shortMetric(active.spec.frontTrack, 'm')} / {shortMetric(active.spec.rearTrack, 'm')}</strong></div>
              <div><span>RIDE HEIGHT</span><strong>{Math.round(active.spec.rideHeight * 1000)}mm</strong></div>
              <div><span>POWERTRAIN</span><strong>{active.spec.powertrain}</strong></div>
              <div><span>REAR WING</span><strong>{Math.round(active.spec.rearWing * 100)}%</strong></div>
              <div><span>DIFFUSER</span><strong>{Math.round(active.spec.diffuserDepth * 1000)}mm</strong></div>
            </div>
            <div className="inspector-note"><Sparkles size={13} /> Schema animation active</div>
          </aside>

          <div className="revision-track">
            <div className="revision-label"><GitBranch size={13} /> {active.branch.toUpperCase()}</div>
            {history.map((revision, index) => <button key={revision.id} className={index === activeIndex ? 'selected' : ''} onClick={() => setStudio((current) => ({ ...current, activeIndex: index }))}><i /><span>v{revision.version}</span></button>)}
            <span className="revision-spacer" /><small>{branchCount} BRANCH{branchCount === 1 ? '' : 'ES'}</small>
          </div>

          <div className="performance-note"><Activity size={13} /><span>60 FPS TARGET</span><i>•</i><span>ORBIT ENABLED</span><i>•</i><span>LOCAL-FIRST</span></div>
        </section>
      </section>
    </main>
  )
}
