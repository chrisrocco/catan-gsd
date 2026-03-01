import { useState } from 'react';
import { RESOURCE_COLORS } from '../../utils/colors';

const COSTS = [
  { name: 'Road', items: [{ resource: 'brick', count: 1 }, { resource: 'lumber', count: 1 }] },
  { name: 'Settlement', items: [{ resource: 'brick', count: 1 }, { resource: 'lumber', count: 1 }, { resource: 'grain', count: 1 }, { resource: 'wool', count: 1 }] },
  { name: 'City', items: [{ resource: 'grain', count: 2 }, { resource: 'ore', count: 3 }] },
  { name: 'Dev Card', items: [{ resource: 'ore', count: 1 }, { resource: 'grain', count: 1 }, { resource: 'wool', count: 1 }] },
];

export default function BuildCosts() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setVisible(!visible)}
        className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600"
      >
        Costs
      </button>

      {visible && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-lg bg-gray-800 p-3 shadow-xl ring-1 ring-gray-600">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Building Costs
          </h3>
          {COSTS.map((cost) => (
            <div key={cost.name} className="mb-2 last:mb-0">
              <p className="text-sm font-semibold text-white">{cost.name}</p>
              <div className="mt-0.5 flex gap-1">
                {cost.items.map((item, i) => (
                  <span
                    key={i}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: RESOURCE_COLORS[item.resource] ?? '#888' }}
                  >
                    {item.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
