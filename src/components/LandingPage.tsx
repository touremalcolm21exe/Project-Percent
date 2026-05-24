import { CheckCircle2, BarChart3, Layers, Share2, ArrowRight, Check } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onSignup: () => void;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/ProgressPercentLogo copy copy.png" alt="Project Percent" className="w-8 h-8 object-contain" />
      <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg tracking-tight">Project Percent</span>
    </div>
  );
}

export default function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-sm font-medium transition-colors px-3 py-1.5"
            >
              Log in
            </button>
            <button
              onClick={onSignup}
              className="bg-brand-gradient text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 shadow-sm"
            >
              Sign up free
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-brand-100 dark:border-brand-900">
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
            Built for solo makers
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight mb-5 max-w-3xl mx-auto">
            Turn your milestones into a live project completion percentage.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            Whether you're an indie dev shipping a side project, a freelancer managing client work, a student hitting thesis deadlines, or a creator building in public — Project Percent keeps you honest and on track.
          </p>

          <ul className="inline-flex flex-col items-start gap-3 text-left mb-10 text-slate-700 dark:text-slate-300 text-base sm:text-lg">
            {[
              'Break any project into clear, checkable milestones',
              'Watch your completion percentage climb in real time',
              'Stay motivated with visible, measurable progress',
              'Share your progress link with clients or followers',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSignup}
              className="flex items-center gap-2 bg-brand-gradient text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-opacity hover:opacity-90 shadow-md hover:shadow-lg"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 font-medium px-7 py-3.5 rounded-xl text-base border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              Log in to your account
            </button>
          </div>
        </section>

        {/* Mock UI preview */}
        <section className="max-w-4xl mx-auto px-5 sm:px-8 pb-20">
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <span className="text-slate-500 text-xs ml-2">projectpercent.app</span>
            </div>
            <div className="p-6 space-y-3">
              {[
                { name: 'Website Redesign', pct: 75, color: '#0088a8' },
                { name: 'Mobile App MVP', pct: 40, color: '#00b8d9' },
                { name: 'API Integration', pct: 100, color: '#10b981' },
                { name: 'Marketing Campaign', pct: 20, color: '#00c8d4' },
              ].map((p) => (
                <div key={p.name} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-200 text-sm font-medium truncate">{p.name}</span>
                      <span className={`text-sm font-bold tabular-nums ml-3 ${p.pct === 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {p.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800 py-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-12">
              Everything you need to stay on track
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  icon: Layers,
                  title: 'Milestone-based tracking',
                  desc: 'Break any project into clear, checkable milestones. Completion percentage updates the moment you check one off.',
                },
                {
                  icon: BarChart3,
                  title: 'Live progress bars',
                  desc: "Visual progress bars update instantly. See how far you've come at a glance without digging through task lists.",
                },
                {
                  icon: Share2,
                  title: 'Share with anyone',
                  desc: 'Generate a public link to your project so clients, collaborators, or your audience can follow along.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="w-10 h-10 bg-brand-50 dark:bg-brand-950 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-24">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 text-center mb-3">
            Simple, honest pricing
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-12 text-lg">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">$0</span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">/ month</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Perfect for trying things out.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  'Up to 3 projects',
                  'Up to 100 milestones per project',
                  'Live percentage tracking',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-brand-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignup}
                className="w-full border border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500 text-slate-800 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-400 font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Get started free
              </button>
            </div>

            {/* Premium */}
            <div className="rounded-2xl border-2 border-brand-400 p-8 flex flex-col relative bg-brand-50/40 dark:bg-brand-950/30">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-brand-gradient text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Premium</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">$9.99</span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">/ month</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">For builders who mean business.</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  'Up to 500 projects',
                  'Up to 100 milestones per project',
                  'Live percentage tracking',
                  'Custom progress bar colors',
                  'Public shareable project links',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-brand-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignup}
                className="w-full bg-brand-gradient text-white font-semibold py-3 rounded-xl text-sm transition-opacity hover:opacity-90 shadow-sm"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </section>

        {/* CTA — always brand gradient, readable regardless of mode */}
        <section className="py-20 text-center" style={{ background: 'linear-gradient(135deg, #1e2070 0%, #2d3091 40%, #0088a8 80%, #00c8d4 100%)' }}>
          <div className="max-w-2xl mx-auto px-5 sm:px-8">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to make real progress?
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              Free to start. No credit card required.
            </p>
            <button
              onClick={onSignup}
              className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-brand-50 shadow-md hover:shadow-lg"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 py-6 text-center">
        <p className="text-slate-400 dark:text-slate-600 text-sm">
          &copy; {new Date().getFullYear()} Project Percent
        </p>
      </footer>
    </div>
  );
}
