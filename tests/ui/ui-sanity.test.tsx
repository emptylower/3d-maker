// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

function Hello({ name }: { name: string }) {
  return <div role="heading">Hello, {name}</div>
}

describe('UI sanity', () => {
  it('renders a simple component', () => {
    render(<Hello name="3D-MARKER" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, 3D-MARKER')
  })
})

