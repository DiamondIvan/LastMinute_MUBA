import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const chartData = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 25 },
  { name: 'Wed', value: 18 },
  { name: 'Thu', value: 42 },
  { name: 'Fri', value: 35 },
  { name: 'Sat', value: 58 },
  { name: 'Sun', value: 75 },
];

export function GrowthChart() {
  return (
    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-lg text-gray-800">Intelligence Growth</h3>
          <p className="text-xs text-gray-400">Weekly query and verification metrics</p>
        </div>
        <span className="bg-white px-3 py-1.5 rounded-xl text-xs font-semibold text-brand shadow-sm">Live Feed</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6B46C1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6B46C1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#9CA3AF" textAnchor="end" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#6B46C1" strokeWidth={3} fillOpacity={1} fill="url(#colorBrand)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}