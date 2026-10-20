'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { login, type LoginState } from '../../lib/auth';

const initial: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden />
          Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initial);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-shell">
      {/* Brand panel — hidden on small screens so the form gets the room */}
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo" aria-hidden>
            {/* Milk can: lid, tapered neck, body */}
            <svg viewBox="0 0 48 48" width="32" height="32" fill="none">
              <rect x="17" y="7" width="14" height="5" rx="2" fill="#fff" />
              <path
                d="M19 12h10l5 8v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V20z"
                stroke="#fff"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <path d="M15 27h18" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="login-brand-title">VTG MilkSetu</h1>
          <p className="login-brand-tag">Dairy Milk Collection</p>

          <ul className="login-points">
            <li>Track every collection across all dairies</li>
            <li>Rates and totals computed on the server</li>
            <li>Export reports as print-ready PDFs</li>
          </ul>
        </div>

        <p className="login-brand-foot">Authorised personnel only</p>
      </aside>

      {/* Form panel */}
      <main className="login-main">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-badge">Admin Panel</span>
            <h2>Welcome back</h2>
            <p>Sign in to manage dairies and milk records.</p>
          </div>

          {state?.error && (
            <div className="login-error" role="alert">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 7.6v5M12 16.2h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} noValidate>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                placeholder="you@example.com"
                spellCheck={false}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <SubmitButton />
          </form>

          <p className="login-help">
            Lost access? Ask another administrator to reset your password from the server.
          </p>
        </div>

        <p className="login-copy">© {new Date().getFullYear()} VTG MilkSetu</p>
      </main>
    </div>
  );
}
