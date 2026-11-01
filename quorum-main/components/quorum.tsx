'use client'

import { useState } from 'react'
import { Check, ChevronRight, Copy, Plus, Radio, Sparkles, Trash2, Users, X, LogOut, Share2, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRoom, type Phase } from '@/lib/room'
import toast from 'react-hot-toast'

const phases: { key: Phase; label: string }[] = [
  { key: 'lobby', label: 'Lobby' }, 
  { key: 'options', label: 'Options' }, 
  { key: 'rating', label: 'Rating' }, 
  { key: 'revealed', label: 'Revealed' }, 
  { key: 'voting', label: 'Voting' }, 
  { key: 'decided', label: 'Decided' }
]

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Phase Stepper for top bar
function PhaseStepper({ current }: { current: Phase }) {
  const active = phases.findIndex((phase) => phase.key === current)
  return (
    <nav aria-label="Room phases" className="meet-stepper">
      {phases.map((phase, index) => (
        <div key={phase.key} className="meet-stepper-item">
          <div className={
            index === active ? 'meet-stepper-dot meet-stepper-active' : 
            index < active ? 'meet-stepper-dot meet-stepper-done' : 
            'meet-stepper-dot meet-stepper-upcoming'
          }>
            {index < active ? <Check aria-hidden="true" className="w-3 h-3" /> : null}
          </div>
          <span className="meet-stepper-label">{phase.label}</span>
        </div>
      ))}
    </nav>
  )
}

// Participants side panel
function ParticipantsPanel({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const participants = useRoom((state) => state.participants)
  const me = useRoom((state) => state.me)
  const room = useRoom((state) => state.room)
  const phase = useRoom((state) => state.phase)
  const ratingProgress = useRoom((state) => state.ratingProgress)

  return (
    <aside className={`meet-panel ${isOpen ? 'meet-panel-open' : 'meet-panel-closed'}`}>
      <div className="meet-panel-header">
        <h2 className="meet-panel-title">
          <Users className="w-5 h-5" aria-hidden="true" />
          Participants
        </h2>
        <button 
          className="meet-panel-close"
          onClick={onToggle}
          aria-label="Close participants panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {participants.length === 0 ? (
        <p className="meet-panel-empty">No participants yet.</p>
      ) : (
        <ul className="meet-panel-list">
          {participants.map((person) => {
            const isHost = person.id === room.hostId
            const isMe = person.id === me.id
            
            return (
              <li key={person.id} className="meet-panel-participant">
                {/* Avatar circle with initials */}
                <div className="meet-avatar meet-avatar-sm">
                  {getInitials(person.name)}
                  <span className={person.connected ? 'meet-avatar-status meet-avatar-online' : 'meet-avatar-status meet-avatar-offline'} />
                </div>

                <div className="meet-panel-info">
                  <div className="flex items-center gap-2">
                    {person.isAI && <Sparkles aria-label="AI participant" className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="meet-panel-name">
                      {person.name}
                      {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                    </span>
                  </div>
                  {isHost && <span className="meet-host-badge">Host</span>}
                  {person.statusLine && <span className="meet-panel-status">{person.statusLine}</span>}
                </div>

                {/* Show rating progress during rating phase */}
                {phase === 'rating' && !person.isAI && (
                  <div className="ml-auto">
                    {/* Simple check mark if they finished */}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Overall progress bar during rating */}
      {phase === 'rating' && ratingProgress.total > 0 && (
        <div className="meet-panel-progress">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Rating progress</span>
            <span className="tabular-nums">{ratingProgress.finished}/{ratingProgress.total}</span>
          </div>
          <div className="meet-progress-bar">
            <div 
              className="meet-progress-fill" 
              style={{ width: `${(ratingProgress.finished / ratingProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}

// Top bar with room info and phase stepper
function RoomHeader() {
  const room = useRoom((s) => s.room)
  const phase = useRoom((s) => s.phase)
  const isConnected = useRoom((s) => s.isConnected)
  const participants = useRoom((s) => s.participants)

  const copyCode = () => {
    if (room.code) {
      navigator.clipboard?.writeText(room.code)
      toast.success('Room code copied')
    }
  }

  return (
    <header className="meet-topbar">
      {/* Left: room title and code */}
      <div className="meet-topbar-left">
        <div className="brand-mark">Q</div>
        <div className="meet-topbar-info">
          <p className="meet-topbar-title">{room.title || 'Untitled room'}</p>
          <button onClick={copyCode} className="meet-code-chip" aria-label="Copy room code">
            {room.code || '------'}
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Center: phase stepper */}
      <div className="meet-topbar-center">
        <PhaseStepper current={phase} />
        <span className="meet-topbar-mobile-phase">{phases.find((item) => item.key === phase)?.label}</span>
      </div>

      {/* Right: connection and participant count */}
      <div className="meet-topbar-right">
        <span className={isConnected ? 'connection-dot connection-active' : 'connection-dot connection-inactive'} 
              title={isConnected ? 'Connected' : 'Reconnecting...'} 
              aria-label={isConnected ? 'Connected' : 'Reconnecting...'} />
        <span className="meet-topbar-count">
          <Users className="w-4 h-4" aria-hidden="true" />
          {participants.length}
        </span>
      </div>
    </header>
  )
}

// Lobby phase - Meet-style participant tiles
function Lobby() { 
  const room = useRoom((s) => s.room)
  const me = useRoom((s) => s.me)
  const participants = useRoom((s) => s.participants)
  const isHost = me.id === room.hostId
  
  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">Make the room ready</h1>
        <p className="meet-stage-description">Invite the people whose input belongs in this decision.</p>
      </div>

      {participants.length === 0 ? (
        <div className="meet-empty">
          <Radio className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
          <p>No participants yet.</p>
          <span>Waiting for people to join...</span>
        </div>
      ) : (
        <div className="meet-grid">
          {participants.map((person) => {
            const isMe = person.id === me.id
            const isPersonHost = person.id === room.hostId
            
            return (
              <div key={person.id} className="meet-tile">
                <div className="meet-avatar meet-avatar-lg">
                  {getInitials(person.name)}
                  <span className={person.connected ? 'meet-avatar-status meet-avatar-online' : 'meet-avatar-status meet-avatar-offline'} />
                </div>
                <div className="meet-tile-info">
                  <div className="flex items-center gap-2 justify-center">
                    {person.isAI && <Sparkles className="w-4 h-4 text-primary" aria-label="AI participant" />}
                    <span className="meet-tile-name">
                      {person.name}
                      {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                    </span>
                  </div>
                  {isPersonHost && <span className="meet-host-badge mt-1">Host</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="meet-notice">
        <Radio className="w-5 h-5" aria-hidden="true" />
        <span>
          {isHost 
            ? 'Waiting for people to join. You can start when everyone is here.' 
            : 'Waiting for the host to start...'}
        </span>
      </div>
    </div>
  )
}

// Options phase - grid with pinned add input
function Options() { 
  const options = useRoom((s) => s.options)
  const addOption = useRoom((s) => s.addOption)
  const removeOption = useRoom((s) => s.removeOption)
  const isLoading = useRoom((s) => s.isLoading)
  const [value, setValue] = useState('')
  const valid = options.length >= 2
  
  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">What are the options?</h1>
        <p className="meet-stage-description">Add the choices the room should compare.</p>
      </div>

      {options.length === 0 ? (
        <div className="meet-empty">
          <Plus className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
          <p>No options added yet.</p>
          <span>The room needs at least 2 options.</span>
        </div>
      ) : (
        <div className="meet-options-grid">
          {options.map((option, index) => (
            <div key={option.id} className="meet-option-card">
              <div className="meet-option-header">
                <span className="meet-option-number">{String(index + 1).padStart(2, '0')}</span>
                {option.suggestedByAI && (
                  <span className="meet-ai-chip">
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    AI
                  </span>
                )}
              </div>
              <p className="meet-option-title">{option.title}</p>
              <div className="meet-option-footer">
                <span className="meet-option-author">Added by {option.addedBy}</span>
                <button 
                  className="meet-icon-btn meet-icon-btn-sm" 
                  aria-label={`Remove ${option.title}`} 
                  onClick={() => removeOption(option.id)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="meet-option-add">
        <input 
          aria-label="Add an option" 
          maxLength={80} 
          value={value} 
          onChange={(e) => setValue(e.target.value)} 
          onKeyDown={(e) => { 
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && value.trim() && !isLoading) { 
              addOption(value)
              setValue('') 
            } 
          }} 
          placeholder="Add an option" 
          className="meet-option-input"
        />
        <Button 
          size="icon" 
          aria-label="Add option" 
          disabled={!value.trim() || options.length >= 10 || isLoading} 
          onClick={() => { 
            addOption(value)
            setValue('') 
          }}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <p className="meet-count-note">{options.length}/10 options</p>

      {!valid && (
        <div className="meet-validation" aria-live="polite">
          {options.length < 2 && <span>Needs at least 2 options.</span>}
        </div>
      )}
    </div>
  )
}

// Rating phase - carousel with one option at a time
function Rating() { 
  const options = useRoom((s) => s.options)
  const ratings = useRoom((s) => s.myRatings)
  const setRating = useRoom((s) => s.setRating)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  
  const finished = options.length > 0 && options.every((option) => ratings[option.id])
  const currentOption = options[currentIndex]

  const goNext = () => {
    if (currentIndex < options.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (!currentOption) {
    return (
      <div className="meet-stage">
        <div className="meet-empty">
          <p>No options to rate.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">Rate each option</h1>
        <p className="meet-stage-description">Your scores stay private until the host reveals them.</p>
      </div>

      <div className="meet-notice-privacy">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Only you can see your ratings until the host reveals them.</span>
      </div>

      {/* Carousel */}
      <div className="meet-carousel">
        <button 
          className="meet-carousel-btn meet-carousel-prev"
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Previous option"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="meet-rating-card">
          <div className="meet-rating-card-header">
            <h2 className="meet-rating-card-title">{currentOption.title}</h2>
            <p className="meet-rating-card-subtitle">1 lowest, 5 highest</p>
          </div>

          {/* Score buttons */}
          <div className="meet-score-group" role="radiogroup" aria-label={`Rating for ${currentOption.title}`}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                data-score={score}
                aria-label={`${score} out of 5`}
                aria-checked={ratings[currentOption.id]?.score === score}
                role="radio"
                className={ratings[currentOption.id]?.score === score ? 'meet-score-btn meet-score-selected' : 'meet-score-btn'}
                onClick={() => setRating(currentOption.id, score as 1 | 2 | 3 | 4 | 5, reasons[currentOption.id] || '')}
              >
                {score}
              </button>
            ))}
          </div>

          {/* Optional reason */}
          <input
            className="meet-reason-input"
            maxLength={200}
            value={reasons[currentOption.id] || ''}
            onChange={(event) => {
              const reason = event.target.value
              setReasons({ ...reasons, [currentOption.id]: reason })
              if (ratings[currentOption.id]) {
                setRating(currentOption.id, ratings[currentOption.id].score, reason)
              }
            }}
            placeholder="Optional reason"
            aria-label={`Reason for ${currentOption.title}`}
          />

          {/* Progress dots */}
          <div className="meet-progress-dots">
            {options.map((_, index) => (
              <button
                key={index}
                className={index === currentIndex ? 'meet-progress-dot meet-progress-active' : 'meet-progress-dot'}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to option ${index + 1}`}
              />
            ))}
          </div>

          <p className="meet-carousel-counter">
            {currentIndex + 1} of {options.length}
          </p>
        </div>

        <button 
          className="meet-carousel-btn meet-carousel-next"
          onClick={goNext}
          disabled={currentIndex === options.length - 1}
          aria-label="Next option"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      </div>

      {finished && (
        <div className="meet-finished">
          <Check className="w-5 h-5" aria-hidden="true" />
          <span>You've finished</span>
        </div>
      )}

      {!finished && (
        <p className="meet-validation">Rate every option to finish.</p>
      )}
    </div>
  )
}

// Revealed phase - matrix with reveal animation
function Revealed() { 
  const options = useRoom((s) => s.options)
  const participants = useRoom((s) => s.participants)
  const revealed = useRoom((s) => s.revealed)
  const analysis = useRoom((s) => s.analysis)
  const aiStatus = useRoom((s) => s.aiStatus)
  const names = participants.filter((person) => !person.isAI)
  
  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">See where the room landed</h1>
        <p className="meet-stage-description">The group can now compare the reasoning behind each score.</p>
      </div>

      {aiStatus && (
        <div className="meet-notice-ai">
          <Sparkles className="w-5 h-5 animate-pulse" aria-hidden="true" />
          <span>{aiStatus}</span>
        </div>
      )}

      {analysis?.aiUnavailable && (
        <div className="meet-notice">
          <span>AI unavailable. Showing a calculated analysis.</span>
        </div>
      )}

      {/* Desktop: matrix table */}
      <div className="meet-matrix-wrap">
        <table className="meet-matrix">
          <thead>
            <tr>
              <th>Option</th>
              {names.map((person) => <th key={person.id}>{person.name}</th>)}
              <th>Mean</th>
              <th>Spread</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <tr key={option.id} className="meet-matrix-reveal">
                <th>
                  {option.title}
                  {analysis?.disagreements.includes(option.id) && (
                    <span className="meet-contested-badge">Contested</span>
                  )}
                </th>
                {names.map((person) => {
                  const score = revealed?.ratings[option.id]?.[person.id]
                  return (
                    <td key={person.id} className={`tabular-nums meet-matrix-cell${typeof score === 'number' ? ` score-tint-${score}` : ''}`}>
                      {score ?? '—'}
                    </td>
                  )
                })}
                <td className="tabular-nums meet-matrix-stat">{revealed?.means[option.id] ?? '—'}</td>
                <td className="tabular-nums meet-matrix-stat">{revealed?.spreads[option.id] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="meet-matrix-mobile">
        {options.map((option) => (
          <article key={option.id} className="meet-rating-mobile-card">
            <h3>{option.title}</h3>
            {names.map((person) => {
              const score = revealed?.ratings[option.id]?.[person.id]
              return (
                <p key={person.id}>
                  <span>{person.name}</span>
                  <strong className={`tabular-nums rounded-md px-1.5${typeof score === 'number' ? ` score-tint-${score}` : ''}`}>
                    {score ?? '—'}
                  </strong>
                </p>
              )
            })}
            <small>Mean {revealed?.means[option.id] ?? '—'} · Spread {revealed?.spreads[option.id] ?? '—'}</small>
          </article>
        ))}
      </div>

      {/* AI Analysis */}
      <section className="meet-analysis" aria-labelledby="analysis-title">
        <p className="eyebrow">Analysis · Quorum AI</p>
        <h2 id="analysis-title">What the room is telling you</h2>
        <p>{analysis?.verdicts && Object.values(analysis.verdicts).join(' ')}</p>
        {analysis?.disagreements?.map((id) => (
          <p key={id}>
            <strong>Contested:</strong> {options.find((option) => option.id === id)?.title}. {analysis.verdicts[id]}
          </p>
        ))}
        {analysis?.compromise && <p><strong>Proposed compromise:</strong> {analysis.compromise}</p>}
      </section>
    </div>
  )
}

// Voting phase - selectable tiles with live vote bars
function Voting() { 
  const options = useRoom((s) => s.options)
  const votes = useRoom((s) => s.votes)
  const participants = useRoom((s) => s.participants)
  const me = useRoom((s) => s.me)
  const vote = useRoom((s) => s.vote)
  const isLoading = useRoom((s) => s.isLoading)
  const [selected, setSelected] = useState<string[]>([])
  const voted = votes?.votedBy.includes(me.id) ?? false
  
  const submit = () => {
    if (!voted && selected.length > 0) {
      vote(selected)
    }
  }
  
  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">What can you live with?</h1>
        <p className="meet-stage-description">Choose every option you could support if the room decided today.</p>
      </div>

      <div className="meet-notice">
        <span>Approval voting · select all that apply.</span>
      </div>

      <div className="meet-voting-list">
        {options.map((option) => {
          const voteCount = votes?.counts[option.id] ?? 0
          const votePercent = participants.length > 0 ? (voteCount / participants.length) * 100 : 0
          
          return (
            <label key={option.id} className="meet-voting-item">
              <input 
                type="checkbox" 
                checked={selected.includes(option.id)} 
                disabled={voted} 
                onChange={() => {
                  if (!voted) {
                    setSelected((current) => 
                      current.includes(option.id) 
                        ? current.filter((id) => id !== option.id) 
                        : [...current, option.id]
                    )
                  }
                }} 
                className="meet-checkbox"
              />
              <div className="meet-voting-content">
                <div className="meet-voting-text">
                  <strong>{option.title}</strong>
                  <span>I can live with this</span>
                </div>
                <span className="meet-voting-count">{voteCount}</span>
              </div>
              {/* Vote bar */}
              <div className="meet-voting-bar">
                <div className="meet-voting-fill" style={{ width: `${votePercent}%` }} />
              </div>
            </label>
          )
        })}
      </div>

      {!voted && selected.length > 0 && (
        <Button 
          className="meet-submit-button"
          disabled={isLoading}
          onClick={submit}
        >
          {isLoading ? 'Submitting...' : `Submit ${selected.length} approval${selected.length !== 1 ? 's' : ''}`}
        </Button>
      )}

      <div className="meet-vote-progress">
        <span>{votes?.votedBy.length ?? 0} of {participants.length} voted</span>
      </div>

      {voted && (
        <div className="meet-finished">
          <Check className="w-5 h-5" aria-hidden="true" />
          <span>You've finished.</span>
        </div>
      )}

      {!voted && selected.length === 0 && (
        <p className="meet-validation">Select at least one option.</p>
      )}
    </div>
  )
}

// Decided phase - end screen with winner card
function Decided() { 
  const options = useRoom((s) => s.options)
  const votes = useRoom((s) => s.votes)
  const analysis = useRoom((s) => s.analysis)
  const me = useRoom((s) => s.me)
  const room = useRoom((s) => s.room)
  const [copied, setCopied] = useState(false)
  
  const voteCounts = votes?.counts ?? {}
  const winnerCount = Math.max(0, ...Object.values(voteCounts))
  const winners = options.filter((option) => (voteCounts[option.id] ?? 0) === winnerCount && winnerCount > 0)
  const tied = winners.length > 1
  
  const markdown = `# ${room.title}\n\n${tied ? 'Tie: ' : 'Winner: '}${winners.map((option) => option.title).join(', ')}\n\n${options.map((option) => `- ${option.title}: ${voteCounts[option.id] ?? 0} approvals`).join('\n')}\n\n${analysis?.compromise ?? ''}`
  
  const copy = async () => { 
    await navigator.clipboard?.writeText(markdown)
    setCopied(true)
    toast.success('Copied to clipboard')
    window.setTimeout(() => setCopied(false), 1400) 
  }
  
  return (
    <div className="meet-stage">
      <div className="meet-stage-header">
        <h1 className="meet-stage-title">The room has decided</h1>
        <p className="meet-stage-description">A clear record of the room's final position.</p>
      </div>

      {/* Winner/Tie hero */}
      <section className="meet-decision-hero">
        {tied ? (
          <>
            <p className="eyebrow">Explicit tie</p>
            <h2 className="meet-decision-title">There isn't one clear winner.</h2>
            {analysis?.compromise && (
              <div className="meet-compromise">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
                <div>
                  <strong>AI compromise</strong>
                  <p>{analysis.compromise}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="eyebrow">Winner</p>
            <h2 className="meet-decision-title">{winners[0]?.title ?? 'No option received approval.'}</h2>
          </>
        )}
      </section>

      {/* Approval summary */}
      <div className="meet-summary-list">
        {options.map((option) => {
          const count = voteCounts[option.id] ?? 0
          const isWinner = winners.some(w => w.id === option.id) && winnerCount > 0
          
          return (
            <div key={option.id} className={isWinner ? 'meet-summary-item meet-summary-winner' : 'meet-summary-item'}>
              <span>{option.title}</span>
              <strong className="tabular-nums">{count}</strong>
            </div>
          )
        })}
      </div>

      {/* Key disagreements */}
      {analysis?.disagreements && analysis.disagreements.length > 0 && (
        <section className="meet-analysis">
          <p className="eyebrow">Key disagreements</p>
          <p>{analysis.disagreements.map((id) => options.find((option) => option.id === id)?.title).filter(Boolean).join(' · ')}</p>
        </section>
      )}

      {/* AI summary */}
      <section className="meet-analysis">
        <p className="eyebrow">Quorum AI summary</p>
        <p>{analysis?.verdicts && Object.values(analysis.verdicts).join(' ') || 'No written summary was supplied.'}</p>
      </section>

      {/* End actions */}
      <div className="meet-end-actions">
        {tied && analysis?.compromise && me.id === room.hostId && (
          <Button onClick={() => useRoom.getState().acceptCompromise()}>
            Accept AI compromise
          </Button>
        )}
      </div>
    </div>
  )
}



// Bottom control bar - Meet-style floating pill
function ControlBar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }) {
  const phase = useRoom((s) => s.phase)
  const me = useRoom((s) => s.me)
  const room = useRoom((s) => s.room)
  const participants = useRoom((s) => s.participants)
  const isLoading = useRoom((s) => s.isLoading)
  const options = useRoom((s) => s.options)
  const votes = useRoom((s) => s.votes)
  const myRatings = useRoom((s) => s.myRatings)
  
  const isHost = me.id === room.hostId
  
  const startOptions = useRoom((s) => s.startOptions)
  const startRating = useRoom((s) => s.startRating)
  const revealRatings = useRoom((s) => s.revealRatings)
  const openVoting = useRoom((s) => s.openVoting)
  const closeVoting = useRoom((s) => s.closeVoting)
  
  const copyRoomLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href)
      toast.success('Room link copied')
    }
  }

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the room?')) {
      window.location.href = '/'
    }
  }

  // Get the right action button for current phase
  const getPhaseAction = () => {
    switch (phase) {
      case 'lobby':
        if (isHost) {
          return (
            <Button 
              className="meet-control-primary"
              disabled={isLoading}
              onClick={startOptions}
            >
              {isLoading ? 'Starting...' : 'Start options'}
            </Button>
          )
        }
        return (
          <div className="meet-control-waiting">
            <span>Waiting for the host to start...</span>
          </div>
        )
        
      case 'options':
        if (isHost) {
          const valid = options.length >= 2
          return (
            <Button 
              className="meet-control-primary"
              disabled={!valid || isLoading}
              onClick={startRating}
            >
              {isLoading ? 'Starting...' : 'Start rating'}
            </Button>
          )
        }
        return (
          <div className="meet-control-waiting">
            <span>Waiting for the host...</span>
          </div>
        )
        
      case 'rating':
        if (isHost) {
          return (
            <Button 
              className="meet-control-primary"
              disabled={isLoading}
              onClick={revealRatings}
            >
              {isLoading ? 'Revealing...' : 'Reveal ratings'}
            </Button>
          )
        }
        return (
          <div className="meet-control-waiting">
            <span>Waiting for the host to reveal...</span>
          </div>
        )
        
      case 'revealed':
        if (isHost) {
          return (
            <Button 
              className="meet-control-primary"
              disabled={isLoading}
              onClick={openVoting}
            >
              {isLoading ? 'Opening...' : 'Open voting'}
            </Button>
          )
        }
        return (
          <div className="meet-control-waiting">
            <span>Waiting for the host...</span>
          </div>
        )
        
      case 'voting':
        if (isHost) {
          const allVoted = (votes?.votedBy.length ?? 0) >= participants.length
          return (
            <Button 
              className="meet-control-primary"
              disabled={!allVoted || isLoading}
              onClick={closeVoting}
            >
              {isLoading ? 'Closing...' : 'Close voting'}
            </Button>
          )
        }
        return (
          <div className="meet-control-waiting">
            <span>Waiting for the host...</span>
          </div>
        )
        
      case 'decided':
        // Export button for decided phase
        const voteCounts = votes?.counts ?? {}
        const winnerCount = Math.max(0, ...(votes ? Object.values(votes.counts) : [0]))
        const winners = options.filter((option) => ((voteCounts[option.id] ?? 0) === winnerCount && winnerCount > 0))
        const tied = winners.length > 1
        const analysis = useRoom.getState().analysis
        
        const markdown = `# ${room.title}\n\n${tied ? 'Tie: ' : 'Winner: '}${winners.map((option) => option.title).join(', ')}\n\n${options.map((option) => `- ${option.title}: ${voteCounts[option.id] ?? 0} approvals`).join('\n')}\n\n${analysis?.compromise ?? ''}`
        
        const copyExport = async () => {
          await navigator.clipboard?.writeText(markdown)
          toast.success('Copied to clipboard')
        }
        
        return (
          <Button 
            variant="outline"
            className="meet-control-secondary"
            onClick={copyExport}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            Copy as Markdown
          </Button>
        )
        
      default:
        return null
    }
  }

  return (
    <div className="meet-controlbar">
      {/* Left group */}
      <div className="meet-control-group">
        <button 
          className="meet-control-btn"
          onClick={copyRoomLink}
          aria-label="Copy room link"
          title="Copy room link"
        >
          <Share2 className="w-5 h-5" />
        </button>
        
        <button 
          className="meet-control-btn meet-control-participants"
          onClick={onTogglePanel}
          aria-label="Toggle participants panel"
          title="Participants"
        >
          <Users className="w-5 h-5" />
          <span className="meet-control-badge">{participants.length}</span>
        </button>
      </div>

      {/* Center - primary action */}
      <div className="meet-control-center">
        {getPhaseAction()}
      </div>

      {/* Right group */}
      <div className="meet-control-group">
        {/* AI suggest button - only in options phase */}
        {phase === 'options' && (
          <button 
            className="meet-control-btn meet-control-ai"
            aria-label="AI suggestions"
            title="AI suggestions"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        )}
        
        <button 
          className="meet-control-btn meet-control-leave"
          onClick={handleLeave}
          aria-label="Leave room"
          title="Leave room"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// Main Room component with Meet shell
function Room() { 
  const phase = useRoom((s) => s.phase)
  const [panelOpen, setPanelOpen] = useState(true)
  
  return (
    <div className="meet-shell">
      <RoomHeader />
      
      <div className="meet-main">
        {/* Main stage */}
        <main className="meet-main-stage" aria-live="polite">
          {phase === 'lobby' && <Lobby />}
          {phase === 'options' && <Options />}
          {phase === 'rating' && <Rating />}
          {phase === 'revealed' && <Revealed />}
          {phase === 'voting' && <Voting />}
          {phase === 'decided' && <Decided />}
        </main>

        {/* Participants side panel */}
        <ParticipantsPanel isOpen={panelOpen} onToggle={() => setPanelOpen(!panelOpen)} />
      </div>

      {/* Bottom control bar */}
      <ControlBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(!panelOpen)} />
    </div>
  )
}

export function QuorumApp() { 
  const me = useRoom((s) => s.me)
  
  if (!me.id) {
    return null
  }
  
  return <Room />
}
