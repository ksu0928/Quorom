'use client'

import { JoinRoomPage } from '@/components/join-room'
import { useRoom } from '@/lib/room'
import { QuorumApp } from '@/components/quorum'

export default function JoinPage() {
  const me = useRoom((s) => s.me)
  
  // If already in a room, show the room interface
  if (me.id) {
    return <QuorumApp />
  }
  
  return <JoinRoomPage />
}
