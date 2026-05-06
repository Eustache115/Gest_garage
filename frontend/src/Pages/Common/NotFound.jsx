import React from "react";
import { useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/icons/AllIcon.jsx";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full animate-in zoom-in duration-300">
        <div className="text-8xl font-black text-[#1E3A5F] mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page Non Trouvée</h1>
        <p className="text-gray-500 mb-8">
          Oups ! La page que vous recherchez semble avoir pris un mauvais raccourci.
        </p>
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#1E3A5F] hover:bg-[#162E4D] text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95"
        >
          <DashboardIcon small color="white" />
          Retour au Tableau de Bord
        </button>
      </div>
    </div>
  );
}
