'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ApprovalItem {
  id: string;
  project_id: string | null;
  project_title: string | null;
  action_type: string;
  description: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  email: 'bg-blue-500/20 text-blue-400',
  sms: 'bg-green-500/20 text-green-400',
  post: 'bg-purple-500/20 text-purple-400',
  api_call: 'bg-yellow-500/20 text-yellow-400',
  payment: 'bg-red-500/20 text-red-400',
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      setItems(data.data || []);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedTestItem = async () => {
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'email',
          description: 'Send follow-up email to Ivory Homes lead #847 — "Thanks for visiting the Eagle Mountain model home. Here are the 3 floor plans we discussed..."',
          project_title: 'Lead Nurture Bot',
          payload: {
            to: 'lead847@example.com',
            subject: 'Great meeting you at Eagle Mountain!',
            preview: 'Thanks for visiting the Eagle Mountain model home. Here are the 3 floor plans we discussed...',
          },
        }),
      });
      await fetchItems();
    } catch (error) {
      console.error('Error seeding test item:', error);
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    setActing(id);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Error updating approval:', error);
    } finally {
      setActing(null);
    }
  };

  useEffect(() => {
    fetchItems().then(() => {
      // Seed a test item if queue is empty on first load
    });
  }, []);

  useEffect(() => {
    if (!loading && items.length === 0) {
      seedTestItem();
    }
    // Only run when loading transitions to false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">&larr; Dashboard</Link>
            </div>
            <h1 className="text-4xl font-bold mb-2">Approval Queue</h1>
            <p className="text-gray-400">Actions held by agents awaiting your approval before going live</p>
          </div>
          {items.length > 0 && (
            <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-semibold">
              {items.length} pending
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="text-gray-400">Loading approvals...</div></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">All clear</div>
            <p className="text-sm text-gray-500">No pending approvals. Agents will queue actions here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[item.action_type] || 'bg-gray-500/20 text-gray-400'}`}>
                        {item.action_type}
                      </span>
                      {item.project_title && (
                        <span className="text-xs text-gray-500">from {item.project_title}</span>
                      )}
                      <span className="text-xs text-gray-600">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{item.description}</p>
                    {item.payload && (
                      <div className="mt-3 bg-gray-800/50 rounded p-3 text-xs text-gray-400 font-mono">
                        {Object.entries(item.payload).map(([key, val]) => (
                          <div key={key} className="mb-1">
                            <span className="text-gray-500">{key}:</span>{' '}
                            <span className="text-gray-300">{typeof val === 'string' ? val : JSON.stringify(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => handleAction(item.id, 'approved')}
                    disabled={acting === item.id}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'rejected')}
                    disabled={acting === item.id}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg border border-red-600/30 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
