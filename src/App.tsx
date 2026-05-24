import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { useTheme } from './lib/useTheme';
import type { Session } from '@supabase/supabase-js';
import LandingPage from './components/LandingPage';
import AuthPage, { type AuthView, UnconfirmedGate } from './components/AuthPage';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import SettingsPage from './components/SettingsPage';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { PricingPage } from './pages/PricingPage';
import { SuccessPage } from './pages/SuccessPage';
import { useAuth } from './hooks/useAuth';

type AppView =
  | { page: 'landing' }
  | { page: 'auth'; view: AuthView; redirectAfter?: ProtectedView; pendingEmail?: string }
  | { page: 'dashboard'; upgradeSuccess?: boolean }
  | { page: 'project'; id: string }
  | { page: 'settings' };

type ProtectedView =
  | { page: 'dashboard'; upgradeSuccess?: boolean }
  | { page: 'project'; id: string }
  | { page: 'settings' };

function detectInitialView(): AppView {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;

  if (params.get('reset') === '1' || hash.includes('type=recovery')) {
    return { page: 'auth', view: 'reset-password' };
  }
  // Email confirmation callback — Supabase sets type=signup in the hash fragment
  if (hash.includes('type=signup') || params.get('confirmed') === '1') {
    window.history.replaceState({}, '', window.location.pathname);
    return { page: 'dashboard' };
  }
  if (params.get('upgrade') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    return { page: 'dashboard', upgradeSuccess: true };
  }
  if (params.get('upgrade') === 'cancel') {
    window.history.replaceState({}, '', window.location.pathname);
    return { page: 'dashboard' };
  }
  return { page: 'landing' };
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function DashboardComponent() {
  const { projects, loading, createProject, updateProject, deleteProject } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleCreateProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createProject(projectData);
    setShowCreateModal(false);
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
    await updateProject(id, updates);
    setSelectedProject(null);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    setSelectedProject(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCreateProject={() => setShowCreateModal(true)} />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create your first project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setSelectedProject(project)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
        />
      )}
    </div>
  );
}

function isEmailConfirmed(user: { email_confirmed_at?: string | null } | null): boolean {
  return !!user?.email_confirmed_at;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<AppView>(detectInitialView);
  const [isPremium, setIsPremium] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const { theme, setTheme } = useTheme();

  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        setSession(sessionData.session);
        setEmailConfirmed(isEmailConfirmed(data.user));
        setAuthLoading(false);

        const current = viewRef.current;
        if (data.user) {
          if (current.page !== 'auth' || current.view !== 'reset-password') {
            setView(
              current.page === 'dashboard' || current.page === 'project' || current.page === 'settings'
                ? current
                : { page: 'dashboard' }
            );
          }
        } else {
          if (current.page === 'dashboard' || current.page === 'project' || current.page === 'settings') {
            setView({ page: 'auth', view: 'login', redirectAfter: current });
          }
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setEmailConfirmed(isEmailConfirmed(session?.user ?? null));

        if (event === 'PASSWORD_RECOVERY') {
          setView({ page: 'auth', view: 'reset-password' });
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const current = viewRef.current;
          if (current.page === 'auth') {
            const dest = current.redirectAfter ?? { page: 'dashboard' as const };
            if (current.view !== 'reset-password') {
              setView(dest);
            }
          } else if (current.page === 'landing') {
            setView({ page: 'dashboard' });
          }
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setEmailConfirmed(true);
          setView({ page: 'landing' });
        }
      })();
    });

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getUser().then(({ error }) => {
          if (error) supabase.auth.signOut({ scope: 'local' });
        });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    if (view.page === 'auth') {
      return (
        <AuthPage
          initialView={view.view}
          onBack={() => setView({ page: 'landing' })}
          pendingEmail={view.page === 'auth' ? view.pendingEmail : undefined}
        />
      );
    }
    return (
      <LandingPage
        onLogin={() => setView({ page: 'auth', view: 'login' })}
        onSignup={() => setView({ page: 'auth', view: 'signup' })}
      />
    );
  }

  // Signed in but email not yet confirmed — show the gate instead of the app.
  if (!emailConfirmed) {
    return (
      <UnconfirmedGate
        email={session.user.email ?? ''}
        onSignOut={() => supabase.auth.signOut({ scope: 'local' })}
      />
    );
  }

  if (view.page === 'auth' && view.view === 'reset-password') {
    return <AuthPage initialView="reset-password" />;
  }

  if (view.page === 'settings') {
    return (
      <SettingsPage
        onBack={() => setView({ page: 'dashboard' })}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  if (view.page === 'project') {
    return (
      <ProjectDetail
        projectId={view.id}
        onBack={() => setView({ page: 'dashboard' })}
        onSettings={() => setView({ page: 'settings' })}
        isPremium={isPremium}
      />
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard
                upgradeSuccess={view.page === 'dashboard' ? view.upgradeSuccess : undefined}
                onSelectProject={(id: string) => setView({ page: 'project', id })}
                onSettings={() => setView({ page: 'settings' })}
                onPlanLoaded={(premium) => setIsPremium(premium)}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}