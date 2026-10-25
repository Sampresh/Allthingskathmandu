'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormError } from '@/components/common/FormStatus'
import { GoogleSignInButton } from '@/components/common/GoogleSignInButton'
import { AuthT as T } from '@/components/common/AuthT'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthT as useT } from '@/hooks/useAuthT'
import {
  completeSignIn,
  enableTwoFactor,
  homeFor,
  login,
  loginWithGoogle,
  safeNext,
  setupTwoFactor,
  verifyTwoFactor,
} from '@/services/auth.service'

const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'v.required').pipe(z.email('v.email')),
  password: z.string().min(1, 'v.required'),
})

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'v.code'),
})

export function LoginForm({ defaultNext, staffOnly = false }) {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  // step: 'password' | 'setup' | 'verify'
  const [step, setStep] = useState('password')
  const [challenge, setChallenge] = useState(null)
  const [setup, setSetup] = useState(null)
  const [error, setError] = useState(null)

  const finish = (session) => {
    const user = completeSignIn(session)
    router.replace(next ?? defaultNext ?? homeFor(user))
  }

  // A sign-in either completes or asks staff for a TOTP step.
  const handleResult = async (result) => {
    if (!result.twoFactor) return finish(result)
    setChallenge(result.challengeToken)
    if (result.twoFactor === 'setup') setSetup(await setupTwoFactor(result.challengeToken))
    setStep(result.twoFactor)
  }

  const run = async (action) => {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err)
      if (err.code === 'CHALLENGE_INVALID') {
        setStep('password')
        setSetup(null)
      }
    }
  }

  if (step === 'password') {
    return (
      <PasswordStep
        error={error}
        onSubmit={(values) => run(async () => handleResult(await login(values)))}
        onGoogle={(idToken) => run(async () => handleResult(await loginWithGoogle(idToken)))}
        staffOnly={staffOnly}
      />
    )
  }

  return (
    <CodeStep
      setup={step === 'setup' ? setup : null}
      error={error}
      onSubmit={({ code }) =>
        run(async () =>
          finish(
            step === 'setup'
              ? await enableTwoFactor(challenge, code)
              : await verifyTwoFactor(challenge, code),
          ),
        )
      }
    />
  )
}

function PasswordStep({ error, onSubmit, onGoogle, staffOnly }) {
  const t = useT()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(credentialsSchema) })

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError error={error}>
          {error?.code === 'EMAIL_NOT_VERIFIED' && (
            <Link href="/verify-email" className="font-semibold underline">
              <T k="auth.resend.submit" />
            </Link>
          )}
        </FormError>
        <Input
          label={<T k="auth.email" />}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('auth.email')}
          error={errors.email && <T k={errors.email.message} />}
          {...register('email')}
        />
        <Input
          label={<T k="auth.password" />}
          type="password"
          autoComplete="current-password"
          error={errors.password && <T k={errors.password.message} />}
          {...register('password')}
        />
        <Link href="/forgot-password" className="self-start text-sm font-semibold text-brand">
          <T k="auth.forgotLink" />
        </Link>
        <Button type="submit" loading={isSubmitting} fullWidth>
          <T k="auth.login.submit" />
        </Button>
      </form>
      {!staffOnly && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <p className="text-center text-sm text-text-muted">
            <T k="common.or" />
          </p>
          <GoogleSignInButton onCredential={onGoogle} />
        </>
      )}
      {!staffOnly && (
        <p className="text-sm text-text-muted">
          <T k="auth.noAccount" />{' '}
          <Link href="/register" className="font-semibold text-brand">
            <T k="auth.registerLink" />
          </Link>
        </p>
      )}
    </div>
  )
}

function CodeStep({ setup, error, onSubmit }) {
  const t = useT()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(codeSchema) })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        <T k="auth.2fa.title" />
      </h2>
      <p className="text-text-muted">
        <T k={setup ? 'auth.2fa.setupIntro' : 'auth.2fa.verifyIntro'} />
      </p>
      {setup && (
        <div className="flex flex-col items-center gap-3">
          <Image
            src={setup.qrCode}
            alt={t('auth.2fa.qrAlt')}
            width={200}
            height={200}
            unoptimized
            className="rounded-box border border-border bg-[#ffffff] p-2"
          />
          <p className="text-center text-sm text-text-muted">
            <T k="auth.2fa.manual" />{' '}
            <code className="font-semibold break-all text-text">{setup.secret}</code>
          </p>
        </div>
      )}
      <FormError error={error} />
      <Input
        label={<T k="auth.2fa.code" />}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code && <T k={errors.code.message} />}
        {...register('code')}
      />
      <Button type="submit" loading={isSubmitting} fullWidth>
        <T k="auth.2fa.submit" />
      </Button>
    </form>
  )
}
