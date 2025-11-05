// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import Header from '@/components/blocks/header'

const headerConfig = {
  disabled: false,
  brand: { title: '3D‑MARKER', logo: { src: '/logo.png', alt: 'logo' }, url: '/zh' },
  nav: {
    items: [
      { title: '创作', url: '/generate' },
      { title: '资产', url: '/my-assets' },
      { title: '广场', url: '/plaza' },
      { title: '登录/注册', url: '/auth/signin' },
    ],
  },
  buttons: [],
  show_sign: false,
  show_theme: false,
  show_locale: false,
}

describe('Header navigation renders required entries', () => {
  it('renders 创作/资产/广场/登录/注册 with links', () => {
    render(<Header header={headerConfig as any} />)
    const create = screen.getByText('创作')
    const assets = screen.getByText('资产')
    const plaza = screen.getByText('广场')
    const auth = screen.getByText('登录/注册')

    expect(create).toBeInTheDocument()
    expect(assets).toBeInTheDocument()
    expect(plaza).toBeInTheDocument()
    expect(auth).toBeInTheDocument()

    expect(create.closest('a')?.getAttribute('href')).toBe('/generate')
    expect(assets.closest('a')?.getAttribute('href')).toBe('/my-assets')
    expect(plaza.closest('a')?.getAttribute('href')).toBe('/plaza')
    expect(auth.closest('a')?.getAttribute('href')).toBe('/auth/signin')
  })
})

