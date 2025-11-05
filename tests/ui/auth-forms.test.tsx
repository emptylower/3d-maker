// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import RegisterForm from '@/components/sign/register-form'
import CredentialsLoginForm from '@/components/sign/credentials-login-form'

describe('Auth forms validation', () => {
  beforeEach(() => {
    // mock fetch
    // @ts-expect-error
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
  })

  it('RegisterForm shows errors for invalid email and weak password', async () => {
    render(<RegisterForm />)

    const email = screen.getByLabelText('邮箱') as HTMLInputElement
    const pwd = screen.getByLabelText('密码') as HTMLInputElement
    const submit = screen.getByRole('button', { name: '注册' })

    // invalid email
    fireEvent.change(email, { target: { value: 'bad-email' } })
    fireEvent.change(pwd, { target: { value: '12345678' } })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效邮箱')

    // weak password
    fireEvent.change(email, { target: { value: 'a@b.com' } })
    fireEvent.change(pwd, { target: { value: '1234567' } })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('密码至少8位')
  })

  it('CredentialsLoginForm shows errors for invalid input', async () => {
    render(<CredentialsLoginForm />)

    const email = screen.getByLabelText('邮箱') as HTMLInputElement
    const pwd = screen.getByLabelText('密码') as HTMLInputElement
    const submit = screen.getByRole('button', { name: '登录' })

    // invalid email
    fireEvent.change(email, { target: { value: 'nope' } })
    fireEvent.change(pwd, { target: { value: '12345678' } })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效邮箱')

    // weak pwd
    fireEvent.change(email, { target: { value: 'a@b.com' } })
    fireEvent.change(pwd, { target: { value: '1234567' } })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('密码至少8位')
  })
})

