"use client";

import { useState, useEffect } from "react";

interface LindyClient {
  id: string;
  name: string;
  setup_paid: boolean;
  monthly_active: boolean;
  created_at: string;
}

const TARGET_CLIENTS = 11;
const MONTHLY_FEE = 97;
const TARGET_MRR = TARGET_CLIENTS * MONTHLY_FEE; // $1,067

export default function RevenueTab() {
  const [clients, setClients] = useState<LindyClient[]>([]);
  const [currentMrr, setCurrentMrr] = useState(0);
  const [loading, setLoading] = useState(true);

  // MRR update modal
  const [showMrrModal, setShowMrrModal] = useState(false);
  const [mrrInput, setMrrInput] = useState("");

  // Add client modal
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [clientsRes, mrrRes] = await Promise.all([
          fetch("/api/lindy-clients"),
          fetch("/api/revenue-settings"),
        ]);
        const clientsData = await clientsRes.json();
        const mrrData = await mrrRes.json();
        setClients(clientsData.data || []);
        setCurrentMrr(mrrData.data?.current_mrr || 0);
      } catch (error) {
        console.error("Error loading revenue data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeClients = clients.filter((c) => c.monthly_active).length;
  const projectedMrr = activeClients * MONTHLY_FEE;
  const mrrProgress = Math.min((currentMrr / TARGET_MRR) * 100, 100);
  const clientProgress = Math.min((clients.length / TARGET_CLIENTS) * 100, 100);

  const handleUpdateMrr = async () => {
    const val = Number(mrrInput);
    if (isNaN(val) || val < 0) return;
    try {
      await fetch("/api/revenue-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_mrr: val }),
      });
      setCurrentMrr(val);
      setShowMrrModal(false);
      setMrrInput("");
    } catch (error) {
      console.error("Error updating MRR:", error);
    }
  };

  const handleAddClient = async () => {
    if (!clientName.trim()) return;
    setAddingClient(true);
    try {
      const res = await fetch("/api/lindy-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim() }),
      });
      const data = await res.json();
      if (data.data) {
        setClients((prev) => [...prev, data.data]);
      }
      setClientName("");
      setShowAddClient(false);
    } catch (error) {
      console.error("Error adding client:", error);
    } finally {
      setAddingClient(false);
    }
  };

  const handleToggleClient = async (
    id: string,
    field: "setup_paid" | "monthly_active",
    current: boolean
  ) => {
    try {
      await fetch(`/api/lindy-clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: !current } : c))
      );
    } catch (error) {
      console.error("Error toggling client:", error);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from client list?`)) return;
    try {
      await fetch(`/api/lindy-clients/${id}`, { method: "DELETE" });
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-jarvis-muted">Loading revenue data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Revenue Dashboard</h2>
        <p className="text-jarvis-muted text-sm">
          Lindy Agent Business &mdash; $750 setup + $97/mo per client
        </p>
      </div>

      {/* Top cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MRR Card */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-jarvis-muted font-semibold uppercase">
              Monthly Recurring Revenue
            </div>
            <button
              onClick={() => {
                setMrrInput(String(currentMrr));
                setShowMrrModal(true);
              }}
              className="text-xs px-2 py-1 rounded bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-colors"
            >
              Update MRR
            </button>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            ${currentMrr.toLocaleString()}
            <span className="text-sm text-jarvis-muted font-normal">/mo</span>
          </div>
          <div className="text-xs text-jarvis-muted mb-3">
            Target: ${TARGET_MRR.toLocaleString()}/mo ({TARGET_CLIENTS} clients)
          </div>
          <div className="w-full bg-jarvis-border rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all bg-jarvis-green"
              style={{ width: `${mrrProgress}%` }}
            />
          </div>
          <div className="text-xs text-jarvis-muted mt-1">
            {mrrProgress.toFixed(0)}% to target
          </div>
        </div>

        {/* Client Count Card */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-5">
          <div className="text-xs text-jarvis-muted font-semibold uppercase mb-3">
            Lindy Clients
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {clients.length}
            <span className="text-sm text-jarvis-muted font-normal">
              {" "}
              of {TARGET_CLIENTS}
            </span>
          </div>
          <div className="text-xs text-jarvis-muted mb-3">
            {activeClients} active &middot;{" "}
            {clients.length - activeClients} setup only
          </div>
          <div className="w-full bg-jarvis-border rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all bg-jarvis-accent"
              style={{ width: `${clientProgress}%` }}
            />
          </div>
          <div className="text-xs text-jarvis-muted mt-1">
            {clients.length}/{TARGET_CLIENTS} clients signed
          </div>
        </div>

        {/* Revenue Projection Card */}
        <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-5">
          <div className="text-xs text-jarvis-muted font-semibold uppercase mb-3">
            Revenue Projection
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-jarvis-muted">Current MRR</div>
              <div className="text-lg font-semibold text-white">
                ${currentMrr.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-jarvis-muted">
                30-day projection
              </div>
              <div className="text-lg font-semibold text-jarvis-green">
                ${projectedMrr.toLocaleString()}
              </div>
              <div className="text-[10px] text-jarvis-muted">
                {activeClients} active clients x ${MONTHLY_FEE}
              </div>
            </div>
            <div>
              <div className="text-xs text-jarvis-muted">
                90-day projection
              </div>
              <div className="text-lg font-semibold text-jarvis-accent">
                ${(projectedMrr * 3).toLocaleString()}
              </div>
              <div className="text-[10px] text-jarvis-muted">
                at current client count
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="bg-jarvis-card border border-jarvis-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-white">Client Tracker</div>
          <button
            onClick={() => setShowAddClient(true)}
            className="text-xs px-3 py-1.5 rounded bg-jarvis-green/20 text-jarvis-green hover:bg-jarvis-green/30 transition-colors"
          >
            + Add Client
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-jarvis-muted text-sm mb-2">
              No clients yet
            </div>
            <p className="text-xs text-jarvis-muted/60">
              Add your first Lindy client to start tracking revenue
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-jarvis-muted px-3 py-1">
              <div className="col-span-5">Name</div>
              <div className="col-span-3 text-center">Setup ($750)</div>
              <div className="col-span-3 text-center">Monthly ($97)</div>
              <div className="col-span-1" />
            </div>
            {clients.map((client) => (
              <div
                key={client.id}
                className="grid grid-cols-12 gap-2 items-center bg-jarvis-border/30 rounded-lg px-3 py-2.5"
              >
                <div className="col-span-5 text-sm text-white truncate">
                  {client.name}
                </div>
                <div className="col-span-3 text-center">
                  <button
                    onClick={() =>
                      handleToggleClient(
                        client.id,
                        "setup_paid",
                        client.setup_paid
                      )
                    }
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      client.setup_paid
                        ? "bg-jarvis-green/20 text-jarvis-green"
                        : "bg-jarvis-border text-jarvis-muted hover:text-white"
                    }`}
                  >
                    {client.setup_paid ? "Paid" : "No"}
                  </button>
                </div>
                <div className="col-span-3 text-center">
                  <button
                    onClick={() =>
                      handleToggleClient(
                        client.id,
                        "monthly_active",
                        client.monthly_active
                      )
                    }
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      client.monthly_active
                        ? "bg-jarvis-green/20 text-jarvis-green"
                        : "bg-jarvis-border text-jarvis-muted hover:text-white"
                    }`}
                  >
                    {client.monthly_active ? "Active" : "No"}
                  </button>
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() =>
                      handleDeleteClient(client.id, client.name)
                    }
                    className="text-jarvis-muted/40 hover:text-red-400 transition-colors"
                    title="Remove client"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update MRR Modal */}
      {showMrrModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowMrrModal(false)}
        >
          <div
            className="bg-jarvis-card border border-jarvis-border rounded-lg p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">Update MRR</h3>
            <div className="mb-4">
              <label className="block text-sm text-jarvis-muted mb-1">
                Current Monthly Recurring Revenue ($)
              </label>
              <input
                type="number"
                value={mrrInput}
                onChange={(e) => setMrrInput(e.target.value)}
                className="w-full px-3 py-2 bg-jarvis-border border border-jarvis-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jarvis-accent"
                placeholder="0"
                min="0"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMrrModal(false)}
                className="flex-1 px-4 py-2 text-jarvis-muted border border-jarvis-border rounded-md hover:bg-jarvis-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMrr}
                className="flex-1 bg-jarvis-accent text-white px-4 py-2 rounded-md hover:bg-jarvis-accent/80 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowAddClient(false)}
        >
          <div
            className="bg-jarvis-card border border-jarvis-border rounded-lg p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">Add Client</h3>
            <div className="mb-4">
              <label className="block text-sm text-jarvis-muted mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 bg-jarvis-border border border-jarvis-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-jarvis-accent"
                placeholder="e.g. John Smith — Keller Williams"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddClient();
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddClient(false);
                  setClientName("");
                }}
                className="flex-1 px-4 py-2 text-jarvis-muted border border-jarvis-border rounded-md hover:bg-jarvis-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClient}
                disabled={!clientName.trim() || addingClient}
                className="flex-1 bg-jarvis-green text-white px-4 py-2 rounded-md hover:bg-jarvis-green/80 disabled:opacity-50 transition-colors"
              >
                {addingClient ? "Adding..." : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
