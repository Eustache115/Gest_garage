import React, { useState, useEffect } from "react";
import api from "../../api.js";
import GarageDataTable from "../../components/DataTable.jsx";

export default function AdminAvis() {
  const [avisList, setAvisList] = useState([]);
  const [loading, setLoading] = useState(true);

  const chargerDonnees = async () => {
    try {
      const resAvis = await api.get("/avis");
      setAvisList(Array.isArray(resAvis.data) ? resAvis.data : []);
    } catch (error) {
      console.error("Erreur chargement avis:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const renderStars = (note) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <span key={index} className={`text-sm ${index < note ? 'text-yellow-400' : 'text-gray-300'}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Avis Clients</h1>
          <p className="text-gray-500 text-sm">Consultez tous les retours et notes laissés par les clients sur leurs interventions.</p>
        </div>
        <button 
          onClick={chargerDonnees}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm shadow-sm hover:bg-gray-50 transition-all active:scale-95"
        >
          Rafraîchir
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <GarageDataTable
          columns={[
            { name: "ID", selector: row => row.id_avis, width: "60px", sortable: true },
            { 
              name: "Client", 
              selector: row => `${row.client_nom_utilisateur} ${row.client_prenom_utilisateur}`,
              cell: row => (
                <div className="font-medium text-gray-800">
                  {row.client_prenom_utilisateur} {row.client_nom_utilisateur}
                </div>
              ),
              sortable: true
            },
            { 
              name: "Intervention", 
              selector: row => row.intervention_desc,
              cell: row => (
                <span className="text-xs text-gray-600 truncate" title={row.intervention_desc}>
                  N°{row.id_intervention} - {row.intervention_desc}
                </span>
              ),
              grow: 2
            },
            { 
              name: "Note", 
              selector: row => row.note,
              cell: row => <div className="flex">{renderStars(row.note)}</div>,
              sortable: true
            },
            { 
              name: "Commentaire", 
              selector: row => row.commentaire,
              cell: row => <span className="text-xs italic text-gray-500 truncate" title={row.commentaire}>"{row.commentaire || "Aucun"}"</span>,
              grow: 2
            },
            { 
              name: "Date", 
              selector: row => row.created_at,
              cell: row => <span className="text-xs text-gray-400">{new Date(row.created_at).toLocaleDateString("fr-FR")}</span>,
              sortable: true
            }
          ]}
          data={avisList}
          loading={loading}
          noDataMessage="Aucun avis enregistré pour le moment."
        />
      </div>
    </div>
  );
}
