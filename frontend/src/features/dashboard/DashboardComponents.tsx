import type { ReactNode } from 'react';
import { Users, Video } from 'lucide-react';

type StatColor = 'blue' | 'green' | 'purple' | 'orange';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  color: StatColor;
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses: Record<StatColor, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
      <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export function ClassItem({ time, title, student, status }: { time: string, title: string, student: string, status: 'live' | 'upcoming' }) {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition border border-transparent hover:border-gray-100">
      <div className="text-center w-16">
        <span className="block font-bold text-gray-800">{time.split(' ')[0]}</span>
        <span className="text-xs text-gray-500 uppercase">{time.split(' ')[1]}</span>
      </div>
      <div className="h-10 w-[2px] bg-gray-200"></div>
      <div className="flex-1">
        <h4 className="font-bold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500 flex items-center gap-1">
          <Users size={14} /> {student}
        </p>
      </div>
      {status === 'live' ? (
        <button className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold animate-pulse flex items-center gap-2">
          <Video size={16} /> Live Now
        </button>
      ) : (
        <button className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200">
          Details
        </button>
      )}
    </div>
  );
}