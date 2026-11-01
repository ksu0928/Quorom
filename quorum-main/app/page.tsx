'use client'

import { LandingPage } from '@/components/landing'
import { useRoom } from '@/lib/room'
import { QuorumApp } from '@/components/quorum'

export default function Page() {
  const me = useRoom((s) => s.me)
  
  // If already in a room, show the room interface
  if (me.id) {
    return <QuorumApp />
  }
  
  return <LandingPage />
}
