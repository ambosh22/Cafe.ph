import { useState, useRef } from "react";
import type { Location } from "../data/locations";
import {
  getAdminLocations,
  removeAdminLocation,
  addAdminLocation,
  exportLocationsJson,
  importLocationsJson,
} from "../data/adminStore";
import { healthyLocations } from "../data/locations";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pickerLat: number | null;
  pickerLng: number | null;
  onStartPicking: () => void;
  onLocationsChanged: () => void;
}

const predefinedCategories = [
  "Specialty",
  "Local",
  "Chain",
  "Bakery",
];

let nextId = Date.now();

export default function AdminPanel({
  isOpen,
  onClose,
  pickerLat,
  pickerLng,
  onStartPicking,
  onLocationsChanged,
}: AdminPanelProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("Healthy Meals");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState("4.0");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [importMsg, setImportMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const adminLocs = getAdminLocations();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || pickerLat === null || pickerLng === null) {
      alert("Please fill in all fields and pick a location on the map.");
      return;
    }
    const finalCat = showCustomCat ? customCategory : category;
    const loc: Location = {
      id: nextId++,
      name,
      address,
      lat: pickerLat,
      lng: pickerLng,
      category: finalCat,
      description,
      rating: parseFloat(rating) || 4.0,
    };
    addAdminLocation(loc);
    setName("");
    setAddress("");
    setDescription("");
    setRating("4.0");
    onLocationsChanged();
  };

  const handleDelete = (id: number) => {
    removeAdminLocation(id);
    onLocationsChanged();
  };

  const handleExport = () => {
    exportLocationsJson(healthyLocations, adminLocs);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importLocationsJson(file);
    if (result.success) {
      setImportMsg({ type: "success", text: `Imported ${result.count} locations` });
      onLocationsChanged();
    } else {
      setImportMsg({ type: "error", text: result.error || "Import failed" });
    }
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setImportMsg(null), 3000);
  };

  const clearAllAdmin = () => {
    if (adminLocs.length === 0) return;
    if (confirm("Delete all admin-added locations?")) {
      adminLocs.forEach((l) => removeAdminLocation(l.id));
      onLocationsChanged();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Admin Panel
          </h2>
          <button className="admin-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="admin-body">
          {/* ── Add New ── */}
          <section className="admin-section">
            <h3>Add New Location</h3>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-field">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Green Bar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>Address</label>
                <input
                  type="text"
                  placeholder="e.g. 119 Rada St, Makati"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>Category</label>
                <div className="admin-cat-row">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={showCustomCat ? "hidden" : ""}
                    style={showCustomCat ? { display: "none" } : undefined}
                  >
                    {predefinedCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {showCustomCat && (
                    <input
                      type="text"
                      placeholder="Custom category"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      autoFocus
                    />
                  )}
                  <button
                    type="button"
                    className="admin-cat-toggle"
                    onClick={() => {
                      setShowCustomCat(!showCustomCat);
                      setCustomCategory("");
                    }}
                    title={showCustomCat ? "Use predefined" : "Custom category"}
                  >
                    {showCustomCat ? "Preset" : "Custom"}
                  </button>
                </div>
              </div>
              <div className="admin-field">
                <label>Description</label>
                <textarea
                  placeholder="Brief description of the place"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="admin-row">
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>Rating (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  />
                </div>
                <div className="admin-field" style={{ flex: 1 }}>
                  <label>Location</label>
                  <button
                    type="button"
                    className={`admin-pick-btn ${pickerLat !== null ? "picked" : ""}`}
                    onClick={onStartPicking}
                  >
                    {pickerLat !== null
                      ? `${pickerLat.toFixed(4)}, ${pickerLng!.toFixed(4)}`
                      : "Click on map"}
                  </button>
                </div>
              </div>
              <button type="submit" className="admin-submit-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Location
              </button>
            </form>
          </section>

          {/* ── Manage Added ── */}
          <section className="admin-section">
            <div className="admin-section-header">
              <h3>Your Added Locations ({adminLocs.length})</h3>
              {adminLocs.length > 0 && (
                <button className="admin-clear-btn" onClick={clearAllAdmin}>
                  Clear all
                </button>
              )}
            </div>
            {adminLocs.length === 0 ? (
              <p className="admin-empty">No custom locations added yet.</p>
            ) : (
              <div className="admin-loc-list">
                {adminLocs.map((loc) => (
                  <div key={loc.id} className="admin-loc-item">
                    <div>
                      <strong>{loc.name}</strong>
                      <span className="admin-loc-cat">{loc.category}</span>
                    </div>
                    <button
                      className="admin-del-btn"
                      onClick={() => handleDelete(loc.id)}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Export / Import ── */}
          <section className="admin-section">
            <h3>Backup & Restore</h3>
            <div className="admin-btn-row">
              <button className="admin-action-btn" onClick={handleExport}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export JSON
              </button>
              <label className="admin-action-btn import-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import JSON
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  hidden
                />
              </label>
            </div>
            {importMsg && (
              <p className={`admin-msg ${importMsg.type}`}>{importMsg.text}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
