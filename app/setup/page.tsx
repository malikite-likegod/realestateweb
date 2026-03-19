'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, ChevronDown, ChevronUp, Database, Mail,
  MessageSquare, Server, Settings, User, Globe,
} from 'lucide-react'

interface FormState {
  environment: 'development' | 'production'
  // MySQL (production only)
  dbHost: string
  dbPort: string
  dbName: string
  dbUser: string
  dbPass: string
  // Admin account
  adminName: string
  adminEmail: string
  adminPassword: string
  adminPasswordConfirm: string
  // App
  appUrl: string
  // SMTP
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  // Twilio
  twilioSid: string
  twilioToken: string
  twilioFrom: string
}

const defaultForm: FormState = {
  environment: 'development',
  dbHost: 'localhost',
  dbPort: '3306',
  dbName: 'realestateweb',
  dbUser: 'root',
  dbPass: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  appUrl: 'http://localhost:3000',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  twilioSid: '',
  twilioToken: '',
  twilioFrom: '',
}

function Field({
  label,
  hint,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  hint?: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-charcoal-200">
        {label}
        {required && <span className="text-gold-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-charcoal-500">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-white placeholder:text-charcoal-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
      />
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  collapsible,
  defaultOpen = false,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-charcoal-700 bg-charcoal-900 overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left ${collapsible ? 'cursor-pointer hover:bg-charcoal-800/50 transition-colors' : 'cursor-default'}`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-charcoal-800 shrink-0">
          <Icon size={16} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {collapsible && (
              <span className="text-xs text-charcoal-500 font-normal">Optional</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-charcoal-500 mt-0.5">{subtitle}</p>}
        </div>
        {collapsible && (
          <div className="text-charcoal-500">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {(!collapsible || open) && (
          <motion.div
            key="content"
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-charcoal-700/50 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (key: keyof FormState) => (value: string) =>
    setForm(f => ({ ...f, [key]: value } as FormState))

  // Check if already configured
  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (data.configured) router.replace('/admin/login')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.adminPassword !== form.adminPasswordConfirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.adminPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.environment === 'production' && (!form.dbHost || !form.dbName)) {
      setError('Database host and name are required for production.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: form.environment,
          dbHost: form.dbHost,
          dbPort: form.dbPort,
          dbName: form.dbName,
          dbUser: form.dbUser,
          dbPass: form.dbPass,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
          appUrl: form.appUrl,
          smtpHost: form.smtpHost || undefined,
          smtpPort: form.smtpPort,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          smtpFrom: form.smtpFrom,
          twilioSid: form.twilioSid || undefined,
          twilioToken: form.twilioToken,
          twilioFrom: form.twilioFrom,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error + (data.details ? `\n\nDetails: ${data.details}` : ''))
      } else {
        setDone(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center">
        <div className="text-charcoal-500 text-sm">Checking configuration…</div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-900/40 border border-green-700 mx-auto mb-6">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white mb-2">Setup Complete</h1>
          <p className="text-charcoal-400 text-sm mb-6">
            Your environment has been configured and the database has been initialized.
          </p>
          <div className="rounded-xl bg-charcoal-900 border border-charcoal-700 px-5 py-4 text-left mb-6">
            <p className="text-sm font-semibold text-gold-400 mb-2">Next step</p>
            <p className="text-sm text-charcoal-300">
              Restart the server to apply your new configuration, then sign in with your admin account.
            </p>
            <pre className="mt-3 rounded-lg bg-charcoal-800 px-3 py-2 text-xs text-charcoal-300 font-mono">
              npm run dev
            </pre>
          </div>
          <a
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-950 font-semibold text-sm px-6 py-2.5 transition-colors"
          >
            Go to Login
          </a>
        </motion.div>
      </div>
    )
  }

  const isProduction = form.environment === 'production'

  return (
    <div className="min-h-screen bg-charcoal-950 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal-800 mx-auto mb-4">
            <Settings size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-white">LuxeRealty Setup</h1>
          <p className="text-charcoal-400 text-sm mt-2">
            Configure your platform before launching. This wizard runs once.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Environment */}
          <div className="rounded-2xl border border-charcoal-700 bg-charcoal-900 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-charcoal-800 shrink-0">
                <Server size={16} className="text-gold-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Environment</h2>
                <p className="text-xs text-charcoal-500">Choose development (SQLite) or production (MySQL)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['development', 'production'] as const).map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => set('environment')(env)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    form.environment === env
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : 'border-charcoal-600 bg-charcoal-800 text-charcoal-300 hover:border-charcoal-500'
                  }`}
                >
                  <div className="font-semibold text-sm capitalize">{env}</div>
                  <div className="text-xs mt-0.5 opacity-70">
                    {env === 'development' ? 'SQLite — easy local testing' : 'MySQL / MariaDB'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* MySQL settings (production only) */}
          <AnimatePresence>
            {isProduction && (
              <motion.div
                key="mysql"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Section
                  icon={Database}
                  title="MySQL / MariaDB"
                  subtitle="Connection details for your production database"
                  defaultOpen
                >
                  <Field label="Host" value={form.dbHost} onChange={set('dbHost')} placeholder="localhost" required />
                  <Field label="Port" value={form.dbPort} onChange={set('dbPort')} placeholder="3306" />
                  <Field label="Database Name" value={form.dbName} onChange={set('dbName')} placeholder="realestateweb" required />
                  <Field label="Username" value={form.dbUser} onChange={set('dbUser')} placeholder="root" />
                  <div className="sm:col-span-2">
                    <Field label="Password" type="password" value={form.dbPass} onChange={set('dbPass')} placeholder="••••••••" />
                  </div>
                </Section>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin account */}
          <Section
            icon={User}
            title="Admin Account"
            subtitle="This will be the primary administrator login"
            defaultOpen
          >
            <div className="sm:col-span-2">
              <Field label="Full Name" value={form.adminName} onChange={set('adminName')} placeholder="Jane Smith" required />
            </div>
            <div className="sm:col-span-2">
              <Field label="Email" type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@yoursite.com" required />
            </div>
            <Field label="Password" type="password" value={form.adminPassword} onChange={set('adminPassword')} placeholder="Min 8 characters" required />
            <Field label="Confirm Password" type="password" value={form.adminPasswordConfirm} onChange={set('adminPasswordConfirm')} placeholder="Repeat password" required />
          </Section>

          {/* App URL */}
          <Section
            icon={Globe}
            title="Application URL"
            subtitle="The public URL where this app will be accessed"
            defaultOpen
          >
            <div className="sm:col-span-2">
              <Field
                label="App URL"
                value={form.appUrl}
                onChange={set('appUrl')}
                placeholder="https://yoursite.com"
                hint="Used for email links and public references"
              />
            </div>
          </Section>

          {/* SMTP Email */}
          <Section
            icon={Mail}
            title="Email Server (SMTP)"
            subtitle="Send emails for leads, drip campaigns, and notifications"
            collapsible
          >
            <div className="sm:col-span-2">
              <Field label="SMTP Host" value={form.smtpHost} onChange={set('smtpHost')} placeholder="smtp.example.com" />
            </div>
            <Field label="Port" value={form.smtpPort} onChange={set('smtpPort')} placeholder="587" />
            <Field label="Username" value={form.smtpUser} onChange={set('smtpUser')} placeholder="you@example.com" />
            <Field label="Password" type="password" value={form.smtpPass} onChange={set('smtpPass')} placeholder="••••••••" />
            <Field
              label="From Address"
              value={form.smtpFrom}
              onChange={set('smtpFrom')}
              placeholder="noreply@yoursite.com"
              hint="Defaults to username if blank"
            />
          </Section>

          {/* Twilio SMS */}
          <Section
            icon={MessageSquare}
            title="Twilio SMS"
            subtitle="Send and receive SMS messages for leads and campaigns"
            collapsible
          >
            <div className="sm:col-span-2">
              <Field
                label="Account SID"
                value={form.twilioSid}
                onChange={set('twilioSid')}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Auth Token"
                type="password"
                value={form.twilioToken}
                onChange={set('twilioToken')}
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="From Number"
                value={form.twilioFrom}
                onChange={set('twilioFrom')}
                placeholder="+15550001234"
                hint="Must be a Twilio-provisioned number"
              />
            </div>
          </Section>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal-950 font-semibold text-sm px-6 py-3 transition-colors"
          >
            {loading ? 'Setting up…' : 'Complete Setup'}
          </button>

          <p className="text-center text-xs text-charcoal-600 pb-4">
            This page is only accessible before the application is configured.
          </p>
        </form>
      </div>
    </div>
  )
}
