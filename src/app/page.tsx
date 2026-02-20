import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Go to Dashboard' : 'Get Started Free';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-gray-900">Xpedia</span>
          <Link
            href={ctaHref}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {user ? 'Dashboard' : 'Sign In'}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Turn your X bookmarks into&nbsp;knowledge
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600">
          Xpedia captures your bookmarks, organizes them by topic with AI, and generates
          living documents you can export as LLM context.
        </p>
        <div className="mt-10">
          <Link
            href={ctaHref}
            className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="mb-3 text-2xl">1</div>
              <h3 className="mb-2 font-semibold text-gray-900">Capture</h3>
              <p className="text-sm text-gray-600">
                Install the Chrome extension. Visit your X bookmarks page and Xpedia
                captures every tweet automatically.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="mb-3 text-2xl">2</div>
              <h3 className="mb-2 font-semibold text-gray-900">Organize</h3>
              <p className="text-sm text-gray-600">
                AI categorizes your tweets into topic and project collections. Create your
                own collections or let the AI decide.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-6">
              <div className="mb-3 text-2xl">3</div>
              <h3 className="mb-2 font-semibold text-gray-900">Export</h3>
              <p className="text-sm text-gray-600">
                Each collection becomes a living document with summaries and conclusions.
                Export Markdown ready for your favorite LLM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">
          Ready to organize your bookmarks?
        </h2>
        <p className="mt-2 text-blue-100">Free to start. No credit card required.</p>
        <div className="mt-8">
          <Link
            href={ctaHref}
            className="rounded-md bg-white px-6 py-3 text-base font-medium text-blue-600 shadow-sm hover:bg-gray-50"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Xpedia. All rights reserved.
      </footer>
    </div>
  );
}
