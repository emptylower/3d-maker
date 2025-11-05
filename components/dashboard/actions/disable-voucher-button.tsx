"use client"

import React from "react";
import { Button } from "@/components/ui/button";

export default function DisableVoucherButton({ code, disabled }: { code: string; disabled?: boolean }) {
  const onClick = async () => {
    try {
      await fetch('/api/vouchers/disable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    } catch (e) {
      console.error('disable voucher failed', e)
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      Disable
    </Button>
  )
}
