/**
 * Utilitaire d'export de données pour Gest_garage
 * - exportCSV : Génère et télécharge un fichier CSV
 * - exportPDF : Ouvre une fenêtre d'impression avec un tableau formaté
 */

// ─── Export CSV ────────────────────────────────────
import logoImage from "../logonouveau.png";
import api from "../api.js";

export function exportCSV(columns, data, filename = "export") {
    const separator = ";";
    const header = columns.map(c => `"${c.label}"`).join(separator);

    const rows = data.map(row =>
        columns.map(c => {
            let val = typeof c.accessor === "function" ? c.accessor(row) : (row[c.accessor] ?? "");
            // Échapper les guillemets
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        }).join(separator)
    );

    // BOM UTF-8 pour que Excel lise correctement les accents
    const bom = "\uFEFF";
    const csv = bom + [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ─── Export PDF (via impression navigateur) ────────
export function exportPDF(columns, data, title = "Liste") {
    const tableRows = data.map(row =>
        `<tr>${columns.map(c => {
            let val = typeof c.accessor === "function" ? c.accessor(row) : (row[c.accessor] ?? "");
            return `<td style="padding:6px 10px;border:1px solid #ddd;font-size:12px">${val}</td>`;
        }).join("")}</tr>`
    ).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
            @media print {
                @page { margin: 15mm; size: landscape; }
            }
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1f2937; }
            h1 { font-size: 20px; margin-bottom: 4px; color: #1E3A5F; }
            .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #1E3A5F; color: #fff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
            tr:nth-child(even) { background: #f9fafb; }
            .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; }
        </style>
    </head>
    <body>
        <h1>🔧 E-GARAGE — ${title}</h1>
        <p class="meta">Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
        <table>
            <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
        <p class="footer">E-GARAGE · Gestion de Garage Intelligente · ${data.length} élément(s)</p>
        <script>window.onload=function(){window.print();}</script>
    </body>
    </html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
}

// ─── Export Document Unique (Facture/Devis) ────────
export async function exportDocumentPDF(typeDocument, data, clientData = null) {
    const title = typeDocument === 'facture' ? 'Facture' : 'Devis';
    const numDoc = data.reference || data.id || 'N/A';
    const dateDoc = typeDocument === 'facture' ? data.date_emission : data.date_creation;

    const clientNom = clientData?.nom || data.client_nom_utilisateur || data.client_nom || '';
    const clientPrenom = clientData?.prenom || data.client_prenom_utilisateur || data.client_prenom || '';

    // Conversion logo en base64 pour l'embed inline dans la popup
    let logoBase64 = '';
    try {
        const resp = await fetch(logoImage);
        const blob = await resp.blob();
        logoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch { logoBase64 = ''; }

    const logoHtml = logoBase64
        ? `<img src="${logoBase64}" alt="Logo" style="height:60px; object-fit:contain;" />`
        : `<span style="font-size:22px; font-weight:bold; color:#1E3A5F;">E-GARAGE</span>`;

    let tableLignes = "";
    if (data.lignes && data.lignes.length > 0) {
        tableLignes = data.lignes.map(l => `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #ddd;">${l.description}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">${l.quantite}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:right;">${(l.prix_unitaire || 0).toLocaleString('fr-FR')} FCFA</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${((l.quantite || 0) * (l.prix_unitaire || 0)).toLocaleString('fr-FR')} FCFA</td>
            </tr>
        `).join("");
    } else {
        const montant = typeDocument === 'facture'
            ? (data.montant_total || 0)
            : (data.total || 0);
        tableLignes = `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #ddd;">Prestation ${typeDocument === 'facture' ? 'facturée' : 'devis'}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">1</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:right;">${montant.toLocaleString('fr-FR')} FCFA</td>
                <td style="padding:10px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${montant.toLocaleString('fr-FR')} FCFA</td>
            </tr>
        `;
    }

    const totalAmount = typeDocument === 'facture'
        ? (data.montant_total || 0)
        : (data.total || 0);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${title} ${numDoc}</title>
        <style>
            @media print {
                @page { margin: 15mm; size: portrait; }
                .no-print { display: none; }
            }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1E3A5F; }
            .garage-info { font-size: 12px; color: #666; margin-top: 8px; line-height: 1.6; }
            .doc-title { font-size: 28px; font-weight: bold; color: #1E3A5F; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .doc-meta { font-size: 13px; margin-top: 10px; line-height: 1.8; }
            .client-box { background: #f0f4f8; padding: 16px 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #1E3A5F; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            th { background: #1E3A5F; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
            td { font-size: 13px; color: #333; }
            tr:nth-child(even) td { background: #f9fafb; }
            .total-box { display: flex; justify-content: flex-end; }
            .total-inner { background: #1E3A5F; color: white; padding: 15px 30px; border-radius: 8px; font-size: 20px; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div style="display:flex; align-items:center; gap:14px;">
                ${logoHtml}
                <div>
                    <div style="font-size:20px; font-weight:bold; color:#1E3A5F;">E-GARAGE</div>
                    <div class="garage-info">
                        Quartier Haie Vive, Cotonou — Bénin<br>
                        contact@gestiongarage.bj | +229 00 00 00 00
                    </div>
                </div>
            </div>
            <div style="text-align:right;">
                <div class="doc-title">${title}</div>
                <div class="doc-meta">
                    <strong>N° :</strong> ${numDoc}<br>
                    <strong>Date :</strong> ${dateDoc ? new Date(dateDoc).toLocaleDateString("fr-FR") : '—'}<br>
                    ${data.date_echeance ? `<strong>Échéance :</strong> ${new Date(data.date_echeance).toLocaleDateString("fr-FR")}` : ''}
                </div>
            </div>
        </div>

        <div class="client-box">
            <strong>Adressé à :</strong><br>
            <span style="font-size:15px;">${clientPrenom} ${clientNom}</span>
            ${data.vehicule_marque ? `<br><span style="font-size:12px; color:#555;">Véhicule : ${data.vehicule_marque} ${data.vehicule_modele || ''} — ${data.vehicule_immatriculation || ''}</span>` : ''}
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:50%;">Description</th>
                    <th style="width:10%; text-align:center;">Qté</th>
                    <th style="width:20%; text-align:right;">P.U. (FCFA)</th>
                    <th style="width:20%; text-align:right;">Total (FCFA)</th>
                </tr>
            </thead>
            <tbody>${tableLignes}</tbody>
        </table>

        <div class="total-box">
            <div class="total-inner">TOTAL : ${totalAmount.toLocaleString('fr-FR')} FCFA</div>
        </div>

        <div class="footer">
            E-GARAGE · Gestion de Garage Intelligente · Imprimé le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
        </div>

        <script>window.onload = function(){ window.print(); }</script>
    </body>
    </html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
}


export async function downloadDocumentPDF(type, id, reference) {
    try {
        // On force le rafraîchissement (pas de cache) pour le téléchargement
        const response = await api.get(`/documents/${type}/${id}`, {
            responseType: 'blob',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        // Vérification si le type de contenu est bien un PDF
        if (response.data.type !== 'application/pdf') {
            // Si le serveur a renvoyé du JSON (erreur) au lieu d'un PDF
            const text = await response.data.text();
            let detail = "Le serveur n'a pas renvoyé un fichier PDF valide.";
            try {
                const errorObj = JSON.parse(text);
                detail = errorObj.detail || detail;
            } catch {
                detail = text || detail;
            }
            throw new Error(detail);
        }

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}_${reference || id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
        console.error("Erreur PDF:", error);
        let message = "Erreur lors du téléchargement.";
        if (error.response?.data instanceof Blob) {
            const text = await error.response.data.text();
            try { 
                const parsed = JSON.parse(text);
                message = parsed.detail || text; 
            } catch { 
                message = text; 
            }
        } else if (error.message) {
            message = error.message;
        }
        throw new Error(message);
    }
}
