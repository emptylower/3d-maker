// Ambient type declarations for the <model-viewer> web component
// Allow JSX usage in TSX without type errors
import * as React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string
        poster?: string
        ar?: boolean | ''
        'camera-controls'?: boolean | ''
        'auto-rotate'?: boolean | ''
        exposure?: number
        [key: string]: any
      }
    }
  }
}

export {}

