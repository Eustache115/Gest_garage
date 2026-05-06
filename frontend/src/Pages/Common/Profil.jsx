import React, { useState } from "react";
import { useAuth } from "../../AuthContext.jsx";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import { UserIcon } from "../../components/icons/AllIcon.jsx";

export default function Profil() {
  const { user, setUser } = useAuth();
  const [formData, setFormData] = useState({
    nom: user.nom_utilisateur || "",
    prenom: user.prenom_utilisateur || "",
    telephone: user.telephone || "",
    email: user.email || ""
  });
  const [loading, setLoading] = useState(false);

  const isDirty = 
    formData.nom !== (user.nom_utilisateur || "") || 
    formData.prenom !== (user.prenom_utilisateur || "") || 
    formData.telephone !== (user.telephone || "");

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put("/auth/profil", {
        nom_utilisateur: formData.nom,
        prenom_utilisateur: formData.prenom,
        telephone: formData.telephone
      });
      setUser({ ...user, ...res.data });
      toast.success("Profil mis à jour !");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-[#1E3A5F] text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
           <UserIcon width="32" height="32" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mon Profil</h1>
          <p className="text-gray-500 text-sm">Gérez vos informations personnelles et la sécurité de votre compte.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Informations Personnelles */}
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-800">Informations Personnelles</h2>
          <form onSubmit={handleUpdateInfo} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Email (Non modifiable)</label>
              <input 
                type="email" 
                disabled 
                className="w-full bg-gray-50 border border-transparent rounded-2xl p-4 text-sm text-gray-400 cursor-not-allowed"
                value={formData.email}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Prénom</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                  value={formData.prenom}
                  onChange={e => setFormData({...formData, prenom: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nom</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                  value={formData.nom}
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Téléphone</label>
              <input 
                type="tel" 
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-semibold"
                value={formData.telephone}
                onChange={e => setFormData({...formData, telephone: e.target.value})}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !isDirty}
              className={`w-full py-4 text-white rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95 ${
                isDirty 
                ? "bg-[#1E3A5F] shadow-blue-900/20 hover:bg-[#162E4D]" 
                : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </form>
        </div>


      </div>
    </div>
  );
}
