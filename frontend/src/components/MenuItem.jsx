import { Link } from "react-router-dom";

export default function MenuItem({ label, active, icon, to, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 relative
        ${active ? "bg-[#1C3558] text-white shadow-md" : "text-white/80 hover:bg-white/5 hover:text-white"}
      `}
    >
      {icon}
      {label}
    </Link>
  );
}