import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";

export default function ClientAvis() {
  const { user } = useAuth();
  const [avisList, setAvisList] = useState([]);
  const [loading, setLoading] = useState(true);

  const chargerAvis = async () => {
    try {
      const res = await api.get(`/avis/client/${user.id_utilisateur}`);
      setAvisList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erreur chargement avis:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerAvis();
  }, [user.id_utilisateur]);

  const renderStars = (note) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <span key={index} className={`text-xl ${index < note ? 'text-yellow-400' : 'text-gray-300'}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mes Avis</h1>
        <p className="text-gray-500 text-sm">Retrouvez ici tous les avis que vous avez laissés sur nos interventions.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A5F]"></div></div>
      ) : avisList.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm p-12 text-center border border-gray-100">
          <p className="text-gray-500">Vous n'avez laissé aucun avis pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {avisList.map((avis) => (
            <div key={avis.id_avis} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex">{renderStars(avis.note)}</div>
                  <span className="text-xs text-gray-400 italic">
                    {new Date(avis.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {avis.intervention_desc && (
                  <p className="text-xs font-semibold text-blue-600 mb-2">Intervention : {avis.intervention_desc}</p>
                )}
                <p className="text-sm text-gray-700 italic">"{avis.commentaire || "Aucun commentaire"}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
