import '@testing-library/jest-dom/vitest'
import { startMsw, stopMsw, resetMsw } from './msw'

beforeAll(() => startMsw())
afterEach(() => resetMsw())
afterAll(() => stopMsw())

// jsdom 环境下补齐 matchMedia，供 SidebarProvider 的 useIsMobile 使用
if (typeof window !== 'undefined' && !window.matchMedia) {
  // @ts-ignore
  window.matchMedia = function () {
    return {
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  } as any
}
