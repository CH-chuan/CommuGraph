'use client';

/**
 * Header Component
 */

export function Header() {
  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CommuGraph</h1>
          <p className="text-sm text-slate-600">
            Deep Analytics on Multi-Agent Chat Logs
          </p>
        </div>
      </div>
    </header>
  );
}
