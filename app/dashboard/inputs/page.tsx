'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import InputListings from '@/components/inputs/InputListings';
import CreateInputListing from '@/components/inputs/CreateInputListing';
import { Store, Plus, ShoppingBag } from 'lucide-react';

export default function InputsShopPage() {
  const { profile } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-agri-primary to-agri-primary-light shadow-lg shadow-agri-primary/20">
            <Store size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Farm Inputs Shop & Supplies
            </h1>
            <p className="text-sm text-foreground-muted">
              Discover verified seeds, organic fertilizers, pesticides, and tools from local suppliers
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="btn btn-primary text-xs flex items-center gap-2 px-4 py-2.5 self-start sm:self-auto shadow-md"
        >
          <Plus size={16} />
          <span>{showCreateModal ? 'Browse Marketplace' : 'List Input for Sale'}</span>
        </button>
      </div>

      {/* Top Banner */}
      <div className="rounded-xl border border-agri-primary/30 bg-gradient-to-r from-agri-primary/10 via-background-card to-background-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
            <span>Direct Supplier-to-Farmer Marketplace</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              0% Commission Gate
            </span>
          </h3>
          <p className="text-xs text-foreground-muted max-w-xl">
            Increase crop yield with high-grade hybrid inputs. Suppliers and commodity sellers list directly without intermediary markups.
          </p>
        </div>
      </div>

      {/* Conditional Create Listing Section */}
      {showCreateModal && (
        <div className="animate-fade-in">
          <CreateInputListing
            onCreated={() => {
              setShowCreateModal(false);
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      )}

      {/* Main Listings Grid */}
      <div className="card p-5 border border-border">
        <InputListings refreshKey={refreshKey} />
      </div>
    </div>
  );
}
