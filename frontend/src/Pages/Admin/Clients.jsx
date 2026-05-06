import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import GarageDataTable from "../../components/DataTable.jsx";
import TableSkeleton from "../../components/TableSkeleton.jsx";
import { PencilIcon, TrashIcon } from "../../components/icons/AllIcon.jsx";
import { exportCSV, exportPDF } from "../../utils/exportUtils.js";
import api from "../../api.js";



const ETATS_COLORS = {
  "Bon état général": "bg-green-100 text-green-700",
  "Quelques rayures": "bg-yellow-100 text-yellow-700",
  "Carrosserie endommagée": "bg-orange-100 text-orange-700",
  "En panne": "bg-red-100 text-red-700",
  "Accidenté": "bg-red-200 text-red-800",
};

const formVide = { nom_utilisateur: "", prenom_utilisateur: "", email: "", telephone: "", adresse: "", ville: "" };

export default function Clients() {
  const isMecanicien = false;
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [form, setForm] = useState(formVide);
  const [modalVisible, setModalVisible] = useState(false);
  const [idASupprimer, setIdASupprimer] = useState(null);
  const [loading, setLoading] = useState(true);

  // Détail client - véhicules
  const [clientDetail, setClientDetail] = useState(null);
  const [vehiculesClient, setVehiculesClient] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);

  const chargerClients = async () => {
    try {
      const res = await api.get("/clients");
      setClients(res.data);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerClients(); }, []);

  // Ouvrir un client s'il est passé dans le state (depuis la barre de recherche)
  useEffect(() => {
    if (clients.length > 0 && location.state?.selectedId) {
      const c = clients.find(cli => cli.id_client === location.state.selectedId);
      if (c) voirVehicules(c);
      window.history.replaceState({}, document.title);
    }
  }, [clients, location.state]);

  // Voir les véhicules d'un client
  const voirVehicules = async (client) => {
    if (clientDetail?.id_client === client.id_client) {
      setClientDetail(null);
      setVehiculesClient([]);
      return;
    }
    setClientDetail(client);
    setLoadingVehicules(true);
    setFormVisible(false);
    try {
      const res = await api.get(`/clients/${client.id_client}/vehicules`);
      setVehiculesClient(res.data);
    } catch {
      setVehiculesClient([]);
    } finally {
      setLoadingVehicules(false);
    }
  };

  const ouvrirAjout = () => { setForm(formVide); setModeEdition(false); setClientSelectionne(null); setFormVisible(true); setClientDetail(null); };

  const ouvrirEdition = (client) => {
    setForm({
      nom_utilisateur: client.nom_utilisateur || "", prenom_utilisateur: client.prenom_utilisateur || "",
      email: client.email || "", telephone: client.telephone || "",
      adresse: client.adresse || "", ville: client.ville || "",
    });
    setModeEdition(true); setClientSelectionne(client.id_client); setFormVisible(true); setClientDetail(null);
  };

  const annuler = () => { setFormVisible(false); setForm(formVide); setModeEdition(false); setClientSelectionne(null); };

  const enregistrer = async () => {
    try {
      if (modeEdition) {
        await api.put(`/clients/${clientSelectionne}`, form);
      } else {
        await api.post("/clients", form);
      }
      await chargerClients();
      annuler();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du client:", error);
      const msg = error.response?.data?.detail || "Une erreur est survenue lors de l'enregistrement.";
      toast.error(`Erreur: ${msg}`);
    }
  };

  const demanderSuppression = (id) => { setIdASupprimer(id); setModalVisible(true); };

  const confirmerSuppression = async () => {
    try {
      await api.delete(`/clients/${idASupprimer}`);
      await chargerClients();
      if (clientDetail?.id_client === idASupprimer) { setClientDetail(null); setVehiculesClient([]); }
    } catch (error) {
      console.error("Erreur lors de la suppression du client:", error);
      const msg = error.response?.data?.detail || "Une erreur est survenue lors de la suppression.";
      toast.error(`Erreur: ${msg}`);
    }
    setModalVisible(false); setIdASupprimer(null);
  };

  const annulerSuppression = () => { setModalVisible(false); setIdASupprimer(null); };

  const totalVehicules = clients.reduce((sum, c) => sum + (c.vehicules_count || 0), 0);
  const showSidePanel = clientDetail; // uniquement le panneau de détail réduit le tableau

  return (
    <>
      {modalVisible && (
        <ConfirmModal
          message="Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible."
          onConfirm={confirmerSuppression}
          onCancel={annulerSuppression}
        />
      )}
      <div>
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
            {clientDetail ? "Détails du Client" : formVisible ? (modeEdition ? "Modifier le Client" : "Ajouter un Client") : "Gestion des Clients"}
          </h1>
          {!isMecanicien && !formVisible && !clientDetail && (
            <button onClick={ouvrirAjout} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95">
              Ajouter un Client
            </button>
          )}
        </div>

        {/* Boutons */}
        {!formVisible && !clientDetail && (
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button onClick={() => {
              const cols = [
                { label: "Nom", accessor: "nom_utilisateur" },
                { label: "Prénom", accessor: "prenom_utilisateur" },
                { label: "Email", accessor: "email" },
                { label: "Téléphone", accessor: "telephone" },
                { label: "Adresse", accessor: "adresse" },
                { label: "Ville", accessor: "ville" },
                { label: "Véhicules", accessor: row => row.vehicules_count || 0 },
              ];
              exportPDF(cols, clients, "Liste des Clients");
            }} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50">
              Télécharger la Liste
            </button>
            <button onClick={() => {
              const cols = [
                { label: "Nom", accessor: "nom_utilisateur" },
                { label: "Prénom", accessor: "prenom_utilisateur" },
                { label: "Email", accessor: "email" },
                { label: "Téléphone", accessor: "telephone" },
                { label: "Adresse", accessor: "adresse" },
                { label: "Ville", accessor: "ville" },
                { label: "Véhicules", accessor: row => row.vehicules_count || 0 },
              ];
              exportCSV(cols, clients, "clients");
            }} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border rounded-xl shadow-sm text-gray-700 text-sm hover:bg-gray-50">
              Exporter CSV
            </button>
          </div>
        )}

        {/* Conteneur principal */}
        <div className="flex flex-col gap-4 sm:gap-6">

          {/* ===== TABLEAU ===== */}
          {!formVisible && !clientDetail && (
            <div className="bg-white rounded-2xl shadow overflow-x-auto">
              <GarageDataTable
                loading={loading}
                columns={[
                  { name: "Nom", selector: row => row.nom_utilisateur, sortable: true, cell: row => <span className="font-medium text-gray-800">{row.nom_utilisateur}</span> },
                  { name: "Prénom", selector: row => row.prenom_utilisateur, sortable: true },
                  { name: "Email", selector: row => row.email, sortable: true, cell: row => <span className="text-gray-600 truncate" title={row.email}>{row.email}</span>, grow: 2 },
                  { name: "Téléphone", selector: row => row.telephone || "", sortable: true },
                  { name: "Ville", selector: row => row.ville || "", sortable: true },
                  { name: "Véhicules", selector: row => row.vehicules_count || 0, sortable: true, cell: row => <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{row.vehicules_count || 0}</span>, width: "90px", center: true },
                  ...(!isMecanicien ? [{
                    name: "Actions", right: true, cell: row => (
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => ouvrirEdition(row)} title="Modifier" className="flex items-center justify-center w-8 h-8 bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-lg transition-all"><PencilIcon /></button>
                        <button onClick={() => demanderSuppression(row.id_client)} title="Supprimer" className="flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"><TrashIcon /></button>
                      </div>
                    ), ignoreRowClick: true, width: "100px"
                  }] : []),
                ]}
                data={clients}
                onRowClicked={voirVehicules}
                conditionalRowStyles={[{ when: row => clientDetail?.id_client === row.id_client, style: { backgroundColor: "#eff6ff", boxShadow: "inset 0 0 0 1px #bfdbfe" } }]}
                noDataMessage="Aucun client enregistré"
              />
            </div>
          )}

          {/* ===== PANEL DÉTAIL VÉHICULES ===== */}
          {clientDetail && !formVisible && (
            <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {clientDetail.prenom_utilisateur} {clientDetail.nom_utilisateur}
                  </h2>
                  <p className="text-sm text-gray-500">Fiche détaillée du client</p>
                </div>
                <button onClick={() => { setClientDetail(null); setVehiculesClient([]); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <span className="text-gray-400 hover:text-gray-600 text-xl">✕</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Info contact */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contact</h3>
                  <div className="bg-blue-50/50 rounded-2xl p-5 space-y-3 border border-blue-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                      <p className="text-gray-700 font-medium">{clientDetail.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      </div>
                      <p className="text-gray-700 font-medium">{clientDetail.telephone}</p>
                    </div>
                  </div>
                </div>

                {/* Info localisation */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Localisation</h3>
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      </div>
                      <p className="text-gray-700 font-medium">{clientDetail.adresse || "Non renseignée"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      </div>
                      <p className="text-gray-700 font-medium">{clientDetail.ville || "Non renseignée"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                    Véhicules (<span className="text-blue-500">{vehiculesClient.length}</span>)
                  </h3>
                </div>

                {loadingVehicules ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
                    <p className="text-sm text-gray-500">Chargement des véhicules...</p>
                  </div>
                ) : vehiculesClient.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                     <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <p className="text-sm text-gray-400 font-medium">Aucun véhicule enregistré pour ce client</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {vehiculesClient.map((v) => (
                      <div key={v.id_vehicule} className="group relative bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-200 transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                               <div className="px-3 py-1 bg-gray-900 text-white rounded-lg font-mono text-sm tracking-widest shadow-sm">
                                {v.immatriculation}
                               </div>
                               {v.etat && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${ETATS_COLORS[v.etat] || "bg-gray-100 text-gray-600"}`}>
                                  {v.etat}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-gray-800 text-lg">
                              {v.marque} <span className="text-blue-600">{v.modele}</span>
                            </h4>
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-sm text-gray-500">
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                Année: {v.annee}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 11h.01M7 15h.01M11 7h.01M11 11h.01M11 15h.01M15 7h.01M15 11h.01M15 15h.01"/></svg>
                                VIN: <span className="font-mono text-xs">{v.numero_chassis}</span>
                              </span>
                            </div>
                            {v.description && (
                              <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600 italic border-l-2 border-gray-300">
                                "{v.description}"
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => { setClientDetail(null); setVehiculesClient([]); }}
                  className="px-8 py-3 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                  Retour à la liste
                </button>
              </div>
            </div>
          )}

          {/* ===== FORMULAIRE ===== */}
          {formVisible && (
            <div className="bg-white rounded-2xl shadow p-6 lg:p-8 w-full max-w-4xl mx-auto">
              <h2 className="font-semibold text-gray-800 mb-4">
                {modeEdition ? "Modifier le Client" : "Ajouter un Client"}
              </h2>
              <div className="flex flex-col gap-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Nom</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom" value={form.nom_utilisateur} onChange={e => setForm({ ...form, nom_utilisateur: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Prénom</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Prénom" value={form.prenom_utilisateur} onChange={e => setForm({ ...form, prenom_utilisateur: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Téléphone" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Adresse" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Ville</label>
                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ville" value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t">
                  <button onClick={annuler} className="px-5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95">Annuler</button>
                  <button onClick={enregistrer} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-500/20 transition-all active:scale-95">
                    Valider
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {!formVisible && !clientDetail && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-sm text-gray-500">Nombre total de clients</p>
              <p className="text-xl font-semibold text-gray-800">{clients.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-sm text-gray-500">Nombre de véhicules enregistrés</p>
              <p className="text-xl font-semibold text-gray-800">{totalVehicules}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-sm text-gray-500">Nouveaux clients ce mois</p>
              <p className="text-xl font-semibold text-gray-800">{clients.filter(c => {
                if (!c.created_at) return false;
                const d = new Date(c.created_at);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
