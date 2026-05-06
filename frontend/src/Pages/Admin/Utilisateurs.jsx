import React, { useState, useEffect } from "react";
import api from "../../api.js";
import { toast } from "react-hot-toast";
import TableSkeleton from "../../components/TableSkeleton.jsx";

const ROLES = [
  { value: "mecanicien", label: "Mécanicien" },
  { value: "receptionniste", label: "Réceptionniste" },
  { value: "client", label: "Client" },
];

const ROLE_BADGE = {
  mecanicien: "badge-meca",
  receptionniste: "badge-recep",
  client: "badge-client",
  admin: "badge-admin",
};

const ROLE_LABEL = {
  mecanicien: "Mécanicien",
  receptionniste: "Réceptionniste",
  client: "Client",
  admin: "Admin",
};

function Utilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nom_utilisateur: "",
    prenom_utilisateur: "",
    email: "",
    telephone: "",
    role: "mecanicien",
    specialite: "",
    adresse: "",
    ville: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [filterRole, setFilterRole] = useState("tous");
  const [search, setSearch] = useState("");

  const chargerUtilisateurs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/utilisateurs");
      setUtilisateurs(res.data);
    } catch {
      setMessage({ type: "error", text: "Impossible de charger les utilisateurs." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerUtilisateurs();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (form.role === "mecanicien") {
        await api.post("/mecaniciens", {
          nom_utilisateur: form.nom_utilisateur,
          prenom_utilisateur: form.prenom_utilisateur,
          email: form.email,
          telephone: form.telephone,
          specialite: form.specialite,
        });
      } else if (form.role === "receptionniste") {
        await api.post("/receptionnistes", {
          nom_utilisateur: form.nom_utilisateur,
          prenom_utilisateur: form.prenom_utilisateur,
          email: form.email,
          telephone: form.telephone,
        });
      } else if (form.role === "client") {
        await api.post("/clients", {
          nom_utilisateur: form.nom_utilisateur,
          prenom_utilisateur: form.prenom_utilisateur,
          email: form.email,
          telephone: form.telephone,
          adresse: form.adresse,
          ville: form.ville,
        });
      }

      toast.success(`Compte créé avec succès. Email envoyé à ${form.email}.`);
      setForm({ nom_utilisateur: "", prenom_utilisateur: "", email: "", telephone: "", role: "mecanicien", specialite: "", adresse: "", ville: "" });
      setShowForm(false);
      chargerUtilisateurs();
    } catch (err) {
      const detail = err.response?.data?.detail || "Une erreur est survenue lors de la création.";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenvoyerEmail = async (user) => {
    setMessage(null);
    try {
      await api.post(`/utilisateurs/${user.id_utilisateur}/renvoyer-email`);
      toast.success(`Email renvoyé à ${user.email}.`);
    } catch {
      toast.error("Impossible de renvoyer l'email d'activation.");
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${user.prenom_utilisateur} ${user.nom_utilisateur} ?`)) return;
    setMessage(null);
    try {
      await api.delete(`/utilisateurs/${user.id_utilisateur}`);
      chargerUtilisateurs();
    } catch (err) {
      const detail = err.response?.data?.detail || "Impossible de supprimer l'utilisateur.";
      toast.error(detail);
    }
  };

  const filteredUsers = utilisateurs.filter((u) => {
    const matchRole = filterRole === "tous" || u.role === filterRole;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${u.nom_utilisateur} ${u.prenom_utilisateur}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  return (
    <div className="font-sans">
      {/* En-tête */}
      <div className="bg-white border-b border-gray-200 px-6 py-6 rounded-2xl mb-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>

          </div>
          <button
            onClick={() => { setShowForm(true); setMessage(null); }}
            className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
          >
            Nouveau compte
          </button>
        </div>
      </div>

      <div className="w-full">

        {/* Message */}
        {message && (
          <div
            className={`mb-5 px-5 py-4 rounded-xl text-sm font-medium border ${message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
              }`}
          >
            {message.text}
          </div>
        )}

        {/* Formulaire de création */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Créer un nouveau compte</h2>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
              >
                Annuler
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rôle */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Rôle
                </label>
                <div className="flex gap-3 flex-wrap">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={form.role === r.value}
                        onChange={handleChange}
                        className="accent-[#1E3A5F]"
                      />
                      <span className="text-sm font-medium text-gray-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Prénom */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  name="prenom_utilisateur"
                  value={form.prenom_utilisateur}
                  onChange={handleChange}
                  required
                  placeholder="Jean"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                />
              </div>

              {/* Nom */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  name="nom_utilisateur"
                  value={form.nom_utilisateur}
                  onChange={handleChange}
                  required
                  placeholder="Dupont"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="jean.dupont@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                />
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Téléphone
                </label>
                <input
                  type="text"
                  name="telephone"
                  value={form.telephone}
                  onChange={handleChange}
                  placeholder="+229 97 ..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                />
              </div>

              {/* Spécialité (mécanicien seulement) */}
              {form.role === "mecanicien" && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Spécialité
                  </label>
                  <input
                    type="text"
                    name="specialite"
                    value={form.specialite}
                    onChange={handleChange}
                    placeholder="Mécanique générale, électronique..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                  />
                </div>
              )}

              {/* Adresse + Ville (client seulement) */}
              {form.role === "client" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Adresse
                    </label>
                    <input
                      type="text"
                      name="adresse"
                      value={form.adresse}
                      onChange={handleChange}
                      placeholder="123 rue example"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Ville
                    </label>
                    <input
                      type="text"
                      name="ville"
                      value={form.ville}
                      onChange={handleChange}
                      placeholder="Cotonou"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] transition"
                    />
                  </div>
                </>
              )}

              {/* Info email activation */}


              {/* Bouton */}
              <div className="md:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-[#1E3A5F]/20 hover:bg-[#162e4d] transition-all disabled:opacity-50"
                >
                  {submitting ? "Création en cours..." : "Créer le compte et envoyer l'email"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filtres */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:border-[#1E3A5F] transition bg-white"
          />
          <div className="flex gap-2 flex-wrap">
            {["tous", "mecanicien", "receptionniste", "client", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterRole === r
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
              >
                {r === "tous" ? "Tous" : ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-dashed">
            Aucun utilisateur trouvé.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Statut compte
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr
                    key={u.id_utilisateur}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-all ${i === filteredUsers.length - 1 ? "border-0" : ""
                      }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center text-[#1E3A5F] font-bold text-sm flex-shrink-0">
                          {u.prenom_utilisateur?.[0]}{u.nom_utilisateur?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {u.prenom_utilisateur} {u.nom_utilisateur}
                          </p>
                          <p className="text-xs text-gray-400">{u.telephone || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${u.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : u.role === "mecanicien"
                            ? "bg-blue-100 text-blue-700"
                            : u.role === "receptionniste"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                          }`}
                      >
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.actif && !u.premiere_connexion ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                          Activé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                          En attente d'activation
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {u.premiere_connexion && u.role !== "admin" && (
                          <button
                            onClick={() => handleRenvoyerEmail(u)}
                            className="px-3 py-1.5 bg-blue-50 text-[#1E3A5F] border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all shadow-sm"
                          >
                            Renvoyer l'activation
                          </button>
                        )}
                        {u.role !== "admin" && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-all shadow-sm"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Légende */}

      </div>

      <style>{`
        .badge-meca { background: #dbeafe; color: #1d4ed8; }
        .badge-recep { background: #ffedd5; color: #c2410c; }
        .badge-client { background: #dcfce7; color: #15803d; }
        .badge-admin { background: #f3e8ff; color: #7e22ce; }
      `}</style>
    </div>
  );
}

export default Utilisateurs;
