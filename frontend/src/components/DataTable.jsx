import DataTable, { createTheme } from "react-data-table-component";
import { StyleSheetManager } from "styled-components";
import TableSkeleton from "./TableSkeleton.jsx";

const shouldForwardProp = (propName, target) => {
    if (typeof target === "string") {
        return ![
            "grow", "center", "right", "align", "wrap", "allowOverflow",
            "button", "minWidth", "maxWidth", "width", "sortable",
            "hide", "ignoreRowClick"
        ].includes(propName);
    }
    return true;
};

// ─── Thème custom ───────────────────────────────────
createTheme("garageTheme", {
    text: { primary: "#1f2937", secondary: "#6b7280" },
    background: { default: "transparent" },
    context: { background: "#e3f2fd", text: "#1f2937" },
    divider: { default: "#e5e7eb" },
    action: { button: "#6b7280", hover: "rgba(30,58,95,0.08)" },
    sortFocus: { default: "#1E3A5F" },
    highlightOnHover: { default: "#f0f9ff", text: "#1f2937" },
    striped: { default: "#f9fafb", text: "#1f2937" },
}, "light");

// ─── Styles personnalisés ───────────────────────────
const customStyles = {
    headRow: {
        style: {
            backgroundColor: "#1E3A5F",
            borderRadius: "12px 12px 0 0",
            minHeight: "42px",
        },
    },
    headCells: {
        style: {
            color: "#ffffff",
            fontSize: "0.75rem",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            paddingLeft: "12px",
            paddingRight: "12px",
        },
    },
    rows: {
        style: {
            fontSize: "0.875rem",
            minHeight: "48px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:hover": {
                backgroundColor: "#f0f9ff !important",
            },
        },
    },
    cells: {
        style: {
            paddingLeft: "12px",
            paddingRight: "12px",
        },
    },
    pagination: {
        style: {
            borderTop: "1px solid #e5e7eb",
            fontSize: "0.8rem",
            color: "#6b7280",
            minHeight: "48px",
        },
    },
};

// ─── Textes FR pour la pagination ───────────────────
const paginationOptions = {
    rowsPerPageText: "Lignes par page :",
    rangeSeparatorText: "sur",
    selectAllRowsItem: true,
    selectAllRowsItemText: "Tous",
};

// ─── Composant réutilisable ─────────────────────────
export default function GarageDataTable({
    columns,
    data,
    onRowClicked,
    conditionalRowStyles,
    title,
    noDataMessage = "Aucune donnée disponible",
    pagination = true,
    paginationPerPage = 10,
    dense = false,
    loading = false,
    ...rest
}) {
    return (
        <StyleSheetManager shouldForwardProp={shouldForwardProp}>
            <DataTable
                columns={columns}
                data={data}
                theme="garageTheme"
                customStyles={customStyles}
                pagination={pagination}
                paginationPerPage={paginationPerPage}
                paginationRowsPerPageOptions={[5, 10, 15, 20, 30]}
                paginationComponentOptions={paginationOptions}
                highlightOnHover
                pointerOnHover={!!onRowClicked}
                onRowClicked={onRowClicked}
                conditionalRowStyles={conditionalRowStyles}
                noDataComponent={
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-3xl mb-2">📋</p>
                        <p className="text-sm">{noDataMessage}</p>
                    </div>
                }
                responsive
                dense={dense}
                progressPending={loading}
                progressComponent={<TableSkeleton rows={paginationPerPage} />}
                sortIcon={<span style={{ marginLeft: 4, color: "#94a3b8" }}>▲</span>}
                {...rest}
            />
        </StyleSheetManager>
    );
}
