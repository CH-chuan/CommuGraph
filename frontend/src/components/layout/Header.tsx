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
            Process Mining for Multi-Agent Interactions
          </p>
        </div>
      </div>
    </header>
  );
}
