import { cn } from '@renderer/lib/utils'
import { BrandLogo } from '@renderer/components/BrandLogo'

export type AppView = 'games' | 'settings' | 'about'

interface TopBarProps {
  view: AppView
  filter: string
  onFilterChange: (value: string) => void
  onViewChange: (view: AppView) => void
  gameCount: number
}

export function TopBar({
  view,
  filter,
  onFilterChange,
  onViewChange,
  gameCount
}: TopBarProps): React.JSX.Element {
  return (
    <header className="dos-titlebar">
      <button
        type="button"
        className="dos-titlebar__brand inline-flex items-center gap-2"
        onClick={() => onViewChange('games')}
      >
        <BrandLogo className="h-8 w-8 shrink-0" />
        DOS Nostalgia
      </button>
      <span className="dos-titlebar__sep">│</span>
      <nav className="flex items-center gap-1">
        {(
          [
            ['games', 'Juegos'],
            ['settings', 'Ajustes'],
            ['about', 'Acerca']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={cn(
              'px-2 py-0.5 uppercase tracking-wide',
              view === id
                ? 'bg-[var(--dos-yellow)] text-[var(--dos-black)]'
                : 'text-[var(--dos-white)] hover:bg-[var(--dos-blue)]'
            )}
          >
            {label}
            {id === 'games' && gameCount > 0 ? ` (${gameCount})` : ''}
          </button>
        ))}
      </nav>

      {view === 'games' && (
        <div className="ml-auto min-w-0 max-w-sm flex-1">
          <input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Buscar..."
            aria-label="Filtrar juegos"
            className="dos-field h-7 w-full text-[18px]"
          />
        </div>
      )}
    </header>
  )
}
