"use client"

import { Button } from "@/components/ui/button";

export default function OfflinePublicationButton({ id, disabled }: { id: number; disabled?: boolean }) {
  const onClick = async () => {
    try {
      await fetch('/api/publications/offline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch (e) {
      console.error('offline publication failed', e)
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      Offline
    </Button>
  )
}

