import { BarChart3, House } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Главная', icon: House },
  { to: '/stats', label: 'Статистика', icon: BarChart3 },
];

export function RootTabBar() {
  return (
    <nav
      aria-label="Основная навигация"
      className="root-tab-bar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `root-tab-link ${isActive ? 'root-tab-link-active' : ''}`
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
