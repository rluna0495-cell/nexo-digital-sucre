'use client';

import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useState } from 'react';
import { KeyRound, LogOut, UserRound, X } from 'lucide-react';
import Sidebar from './Sidebar';
import {
  acknowledgeRecoveryCode,
  authenticate,
  changeAccountCredentials,
  endAuthSession,
  initializeAuth,
  recoverAccountPassword,
  type AuthUser,
} from '../lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthShell.');
  return context;
}

interface AuthShellProps {
  children: ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState('');
  const [recoveryCodeToDisplay, setRecoveryCodeToDisplay] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'login' | 'recovery'>('login');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    initializeAuth()
      .then(result => {
        setUser(result.activeSession);
        setRecoveryCodeToDisplay(result.recoveryCodeToDisplay);
        setReady(true);
      })
      .catch(error => {
        console.error('No se pudo inicializar la sesión local.', error);
        setInitializationError(error instanceof Error ? error.message : 'No se pudo iniciar el sistema.');
        setReady(true);
      });
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const authenticatedUser = await authenticate(
        String(formData.get('username') || ''),
        String(formData.get('password') || ''),
      );
      if (!authenticatedUser) {
        setMessage('Usuario o contraseña incorrectos.');
        return;
      }
      setMessage('');
      setUser(authenticatedUser);
    } catch (error) {
      console.error('No se pudo validar el inicio de sesión.', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo validar el inicio de sesión.');
    }
  };

  const handleRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') || '');
    const code = String(formData.get('recoveryCode') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmation = String(formData.get('confirmPassword') || '');
    if (newPassword.length < 4) {
      setMessage('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    try {
      const recovered = await recoverAccountPassword(username, code, newPassword);
      if (!recovered) {
        setMessage('Usuario o código de recuperación incorrecto.');
        return;
      }
      endAuthSession();
      setMessage('Contraseña actualizada. Ya puedes iniciar sesión.');
      setLoginMode('login');
    } catch (error) {
      console.error('No se pudo recuperar la contraseña.', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo recuperar la contraseña.');
    }
  };

  const handleCredentialChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmation = String(formData.get('confirmPassword') || '');
    const displayName = String(formData.get('displayName') || '');
    if (newPassword.length < 4) {
      setMessage('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setMessage('Las contraseñas nuevas no coinciden.');
      return;
    }
    try {
      const updatedUser = await changeAccountCredentials(currentPassword, newPassword, displayName);
      if (!updatedUser) {
        setMessage('La contraseña actual es incorrecta.');
        return;
      }
      setUser(updatedUser);
      setMessage('Contraseña y perfil actualizados.');
      setAccountDialogOpen(false);
    } catch (error) {
      console.error('No se pudieron actualizar las credenciales.', error);
      setMessage(error instanceof Error ? error.message : 'No se pudieron actualizar las credenciales.');
    }
  };

  const handleLogout = () => {
    endAuthSession();
    setUser(null);
    setLoginMode('login');
    setMessage('');
  };

  const acknowledgeRecovery = () => {
    try {
      acknowledgeRecoveryCode();
      setRecoveryCodeToDisplay(null);
    } catch (error) {
      console.error('No se pudo confirmar el código de recuperación.', error);
      setInitializationError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    }
  };

  return (
    <AuthContext.Provider value={{ user }}>
      {!ready ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0f19] text-sm font-semibold text-slate-300">
          Iniciando sistema...
        </div>
      ) : initializationError ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0f19] p-6 text-center text-sm text-red-300">
          {initializationError}
        </div>
      ) : user ? (
        <div className="flex min-h-screen w-full bg-[#0b0f19]">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-[#131b2e] px-5 py-3.5 md:px-8">
              <span className="truncate text-sm font-semibold text-slate-200">
                Vendedor: <strong className="text-emerald-400">{user.displayName}</strong>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMessage(''); setAccountDialogOpen(true); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
                >
                  <UserRound className="h-4 w-4" />
                  Mi cuenta
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition hover:border-red-500 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </div>
            </header>
            <div className="layout-main flex min-h-0 min-w-0 flex-1">{children}</div>
          </div>

          {accountDialogOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#131b2e] p-6 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-black text-white">Mi cuenta</h2>
                  <button type="button" onClick={() => setAccountDialogOpen(false)} aria-label="Cerrar" className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mb-4 text-xs text-slate-400">Usuario: {user.username}. Confirma tu contraseña actual para guardar cambios.</p>
                <form onSubmit={handleCredentialChange} className="space-y-4">
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                    Nombre del vendedor
                    <input name="displayName" defaultValue={user.displayName} required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                    Contraseña actual
                    <input name="currentPassword" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                    Nueva contraseña
                    <input name="newPassword" type="password" autoComplete="new-password" minLength={4} required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                    Confirmar nueva contraseña
                    <input name="confirmPassword" type="password" autoComplete="new-password" minLength={4} required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
                  </label>
                  {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
                  <button type="submit" className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500">
                    Guardar cambios
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0f19] px-4 py-8">
          <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131b2e] p-7 shadow-2xl">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xl font-black text-emerald-400">N</div>
              <h1 className="text-xl font-black text-white">Nexo Digital Sucre</h1>
              <p className="mt-1 text-sm text-slate-400">{loginMode === 'login' ? 'Inicia sesión para continuar' : 'Recupera el acceso a tu cuenta'}</p>
            </div>

            {recoveryCodeToDisplay && (
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm font-bold text-amber-200">Configuración inicial</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">Usuario: <strong>admin</strong> · Contraseña inicial: <strong>1234</strong>. Guarda este código fuera de este equipo para poder recuperar la contraseña:</p>
                <code className="mt-3 block select-all rounded-lg bg-black/30 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-amber-300">{recoveryCodeToDisplay}</code>
                <button type="button" onClick={acknowledgeRecovery} className="mt-3 w-full rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/10">
                  Ya guardé el código
                </button>
              </div>
            )}

            {loginMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Usuario
                  <input name="username" autoComplete="username" required autoFocus className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Contraseña
                  <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                </label>
                {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
                <button type="submit" className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500">
                  Iniciar Sesión
                </button>
                <button type="button" onClick={() => { setMessage(''); setLoginMode('recovery'); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                  <KeyRound className="h-4 w-4" />
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-4">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Usuario
                  <input name="username" autoComplete="username" required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Código de recuperación
                  <input name="recoveryCode" autoComplete="off" required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm uppercase text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Nueva contraseña
                  <input name="newPassword" type="password" autoComplete="new-password" minLength={4} required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Confirmar contraseña
                  <input name="confirmPassword" type="password" autoComplete="new-password" minLength={4} required className="w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                </label>
                {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
                <button type="submit" className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500">
                  Restablecer contraseña
                </button>
                <button type="button" onClick={() => { setMessage(''); setLoginMode('login'); }} className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white">
                  Volver a Iniciar Sesión
                </button>
              </form>
            )}

            <p className="mt-6 border-t border-slate-800 pt-4 text-center text-[10px] leading-relaxed text-slate-500">
              El acceso es local a este navegador y no reemplaza autenticación de servidor. Los datos se almacenan en este equipo.
            </p>
          </section>
        </div>
      )}
    </AuthContext.Provider>
  );
}
