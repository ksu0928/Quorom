'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useRoom } from '@/lib/room'
import { Video, Copy } from 'lucide-react'

export function LandingPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const createRoom = useRoom((s) => s.createRoom)
  const joinRoom = useRoom((s) => s.joinRoom)
  const isLoading = useRoom((s) => s.isLoading)
  const isConnected = useRoom((s) => s.isConnected)
  const router = useRouter()

  const handleCreate = () => {
    if (name.trim()) {
      createRoom('Team Decision', name)
    }
  }

  const handleJoin = () => {
    if (code.length === 6 && name.trim()) {
      joinRoom(code, name)
    }
  }

  return (
    <div className="meet-home">
      {/* Top bar with logo and connection */}
      <header className="meet-home-header">
        <div className="flex items-center gap-3">
          <div className="brand-mark">Q</div>
          <span className="text-lg font-semibold">Quorum</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={isConnected ? 'connection-dot connection-active' : 'connection-dot connection-inactive'} 
                title={isConnected ? 'Connected' : 'Reconnecting...'} 
                aria-label={isConnected ? 'Connected' : 'Reconnecting...'} />
          <span className="text-sm text-muted-foreground">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
        </div>
      </header>

      {/* Two-column layout */}
      <main className="meet-home-main">
        {/* Left side: headline and controls */}
        <div className="meet-home-left">
          <div className="meet-home-hero">
            <p className="eyebrow">Quorum</p>
            <h1>Decide together,<br />without the group chat.</h1>
            <p className="meet-home-tagline">
              A small room for a clear decision.
            </p>
          </div>

          <div className="meet-home-controls">
            {/* Name input */}
            <div>
              <label className="field-label" htmlFor="landing-name">Your name</label>
              <input 
                id="landing-name"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    handleCreate()
                  }
                }}
                placeholder="Display name" 
                className="meet-home-input"
              />
            </div>

            {/* Create and Join buttons side by side */}
            <div className="meet-home-actions">
              <Button 
                className="flex-1 h-12" 
                disabled={!name.trim() || isLoading}
                onClick={handleCreate}
              >
                <Video aria-hidden="true" />
                {isLoading ? 'Creating...' : 'Create room'}
              </Button>

              <div className="flex gap-2 flex-1">
                <input 
                  aria-label="Room code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      handleJoin()
                    }
                  }}
                  placeholder="ABC123"
                  className="meet-home-code"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
                />
                <Button 
                  variant="outline"
                  disabled={code.length !== 6 || !name.trim() || isLoading}
                  onClick={handleJoin}
                >
                  {isLoading ? 'Joining...' : 'Join with code'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: illustration slot */}
        <div className="meet-home-right">
          <div className="meet-home-illustration" />
        </div>
      </main>
    </div>
  )
}
