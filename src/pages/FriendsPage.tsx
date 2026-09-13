import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, UserPlus } from 'lucide-react';
import { db } from '../db/schema';
import { formatCurrency } from '../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import type { Person } from '../types';
import { FriendDetailModal } from '../components/modals/FriendDetailModal';

interface FriendsPageProps {
  onOpenQuickAdd: (defaultTab?: 'expense' | 'income' | 'transfer' | 'friend', isFriendContext?: boolean) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({ onOpenQuickAdd }) => {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');

  const people = useLiveQuery(() => db.people.filter(p => !p.deletedAt).toArray(), []);

  const totalOwedToUser = (people || [])
    .filter(p => p.netBalanceInPaise > 0)
    .reduce((sum, p) => sum + p.netBalanceInPaise, 0);

  const totalUserOwes = (people || [])
    .filter(p => p.netBalanceInPaise < 0)
    .reduce((sum, p) => sum + Math.abs(p.netBalanceInPaise), 0);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;

    const now = new Date().toISOString();
    await db.people.add({
      id: uuidv4(),
      name: newFriendName.trim(),
      netBalanceInPaise: 0,
      createdAt: now,
      updatedAt: now,
    });

    setNewFriendName('');
    setIsAddFriendOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Friends & Split Bills</h1>
          <p className="text-xs text-[var(--text-secondary)]">Track loans, split expenses, and manage settlements</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddFriendOpen(true)}
            className="py-2.5 px-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-[var(--text-primary)] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <UserPlus className="w-4 h-4 text-[var(--accent)]" /> Add Person
          </button>
          <button
            onClick={() => onOpenQuickAdd('friend', true)}
            className="py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Record Debt / Lend
          </button>
        </div>
      </div>

      {/* Net Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            They Owe You Total (Receivables)
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {formatCurrency(totalOwedToUser)}
          </div>
        </div>

        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider block">
            You Owe Total (Payables)
          </span>
          <div className="text-2xl font-extrabold text-red-500 mt-1">
            {formatCurrency(totalUserOwes)}
          </div>
        </div>
      </div>

      {/* Friends Directory Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">People Directory</h2>

        {people && people.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {people.map(person => {
              const net = person.netBalanceInPaise;
              const isTheyOwe = net > 0;
              const isUserOwes = net < 0;

              return (
                <div
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] rounded-2xl shadow-xs flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">{person.name}</div>
                      <div className="text-xs font-semibold mt-0.5">
                        {net === 0 && <span className="text-[var(--text-tertiary)]">Settled (₹0.00)</span>}
                        {isTheyOwe && (
                          <span className="text-emerald-600">
                            Owes you {formatCurrency(net)}
                          </span>
                        )}
                        {isUserOwes && (
                          <span className="text-red-500">
                            You owe {formatCurrency(Math.abs(net))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedPerson(person);
                    }}
                    className="px-3 py-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] rounded-xl text-xs font-semibold text-[var(--text-primary)]"
                  >
                    View / Settle
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">No friends added yet</div>
              <div className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto mt-0.5">
                Add your classmates or roomies to start splitting dinner bills, cabs, and tracking shared expenses!
              </div>
            </div>
            <button
              onClick={() => setIsAddFriendOpen(true)}
              className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add First Friend
            </button>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {isAddFriendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Add New Friend</h3>
            <form onSubmit={handleAddFriend} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Friend Name</label>
                <input
                  type="text"
                  placeholder="e.g., Alex, Sarah, John"
                  value={newFriendName}
                  onChange={e => setNewFriendName(e.target.value)}
                  autoFocus
                  required
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFriendOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[var(--accent)] text-white shadow-xs"
                >
                  Save Friend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Friend Detail & Settle Up Modal */}
      <FriendDetailModal
        isOpen={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
      />
    </div>
  );
};
