import { db } from './db.js';

// Normalise une URL pour en faire une clé de cache uniforme
function normalizeUrl(url) {
    return url
        .replace(/^https?:\/\/[^/]+/, '') // Retire l'origine (http://127.0.0.1:8000)
        .replace(/\?.*$/, '')             // Retire les query params
        .replace(/\/+$/, '');             // Retire les slashes finaux
}

export async function cacheIncomingData(url, data) {
    try {
        if (!data) return;
        const key = normalizeUrl(url);
        await db.api_cache.put({ url: key, data: data });
    } catch (e) {
        console.error("Erreur de mise en cache locale:", e);
    }
}

export async function getLocalData(url) {
    try {
        let dataToReturn = null;

        // Normaliser l'URL de la requête
        const normalizedReqUrl = normalizeUrl(url);

        // ESSAI 1 : Lecture directe avec clé normalisée
        let cacheEntry = await db.api_cache.get(normalizedReqUrl);

        // ESSAI 2 : Lecture flexible (cherche dans tous les caches)
        if (!cacheEntry) {
            const allCaches = await db.api_cache.toArray();
            cacheEntry = allCaches.find(c => {
                const cleanCacheUrl = normalizeUrl(c.url);
                return cleanCacheUrl === normalizedReqUrl
                    || normalizedReqUrl.endsWith(cleanCacheUrl)
                    || cleanCacheUrl.endsWith(normalizedReqUrl);
            });
        }

        if (cacheEntry) {
            dataToReturn = cacheEntry.data;
        }

        // ── /clients/{id}/vehicules ──
        if (normalizedReqUrl.match(/\/clients\/\d+\/vehicules/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').filter(p => p && !isNaN(p))[0]);
            const allVehiculesCache = await db.api_cache.get('/vehicules');
            if (allVehiculesCache && Array.isArray(allVehiculesCache.data)) {
                dataToReturn = allVehiculesCache.data.filter(v => parseInt(v.id_client) === clientId);
            }
        }

        // ── /vehicules/{id}/reparations ──
        if (normalizedReqUrl.match(/\/vehicules\/\d+\/reparations/)) {
            const parts = normalizedReqUrl.split('/').filter(p => p && !isNaN(p));
            const vehiculeId = parseInt(parts[0]);
            const allRepaCache = await db.api_cache.get('/reparations');
            if (allRepaCache && Array.isArray(allRepaCache.data)) {
                const extracted = allRepaCache.data.filter(r => parseInt(r.id_vehicule) === vehiculeId);
                dataToReturn = dataToReturn ? dataToReturn : extracted;
            }
        }

        // ── /vehicules/client/{id} ──
        if (normalizedReqUrl.match(/\/vehicules\/client\/\d+/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/vehicules');
            if (allCache && Array.isArray(allCache.data)) {
                const extracted = allCache.data.filter(i => parseInt(i.id_client) === clientId);
                dataToReturn = dataToReturn && dataToReturn.length > 0 ? dataToReturn : extracted;
            }
        }

        // ── /devis/client/{id} ──
        if (normalizedReqUrl.match(/\/devis\/client\/\d+/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/devis');
            if (allCache && Array.isArray(allCache.data)) {
                const extracted = allCache.data.filter(i => parseInt(i.id_client) === clientId);
                dataToReturn = dataToReturn && dataToReturn.length > 0 ? dataToReturn : extracted;
            }
        }

        // ── GET /devis/{id} — cherche dans le cache liste ──
        if (!dataToReturn && normalizedReqUrl.match(/\/devis\/\d+$/)) {
            const devisId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/devis');
            if (allCache && Array.isArray(allCache.data)) {
                const found = allCache.data.find(d => d.id_devis === devisId);
                if (found) dataToReturn = found;
            }
        }

        // ── /factures/client/{id} ──
        if (normalizedReqUrl.match(/\/factures\/client\/\d+/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/factures');
            if (allCache && Array.isArray(allCache.data)) {
                const extracted = allCache.data.filter(i => parseInt(i.id_client) === clientId);
                dataToReturn = dataToReturn && dataToReturn.length > 0 ? dataToReturn : extracted;
            }
        }

        // ── /interventions/client/{id} ──
        if (normalizedReqUrl.match(/\/interventions\/client\/\d+/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/interventions');
            if (allCache && Array.isArray(allCache.data)) {
                const extracted = allCache.data.filter(i => parseInt(i.id_client) === clientId);
                dataToReturn = dataToReturn && dataToReturn.length > 0 ? dataToReturn : extracted;
            }
        }

        // ── /rendezvous/client/{id} ──
        if (normalizedReqUrl.match(/\/rendezvous\/client\/\d+/)) {
            const clientId = parseInt(normalizedReqUrl.split('/').pop());
            const allCache = await db.api_cache.get('/rendezvous');
            if (allCache && Array.isArray(allCache.data)) {
                const extracted = allCache.data.filter(i => parseInt(i.id_client) === clientId);
                dataToReturn = dataToReturn && dataToReturn.length > 0 ? dataToReturn : extracted;
            }
        }

        return dataToReturn;

    } catch (e) {
        console.error("Erreur de lecture du cache local:", e);
    }
    return null;
}

export async function enqueueMutation(config) {
    try {
        let requestData = config.data;
        if (typeof requestData === 'string') {
            try { requestData = JSON.parse(requestData); } catch { }
        }

        await db.sync_queue.add({
            method: config.method,
            url: config.url,
            data: requestData,
            timestamp: new Date().toISOString()
        });

        // ─────────────────────────────────────────────────────
        // MISE À JOUR OPTIMISTE DU CACHE (affichage immédiat)
        // ─────────────────────────────────────────────────────
        try {
            const method = config.method.toUpperCase();
            const fullUrl = config.url;

            // ══ CAS SPÉCIAL : POST /devis/{id}/generer-facture ══
            // Hors-ligne : on marque le devis comme facturé et on crée
            // une facture temporaire visible immédiatement dans le cache.
            if (method === 'POST' && fullUrl.match(/\/devis\/\d+\/generer-facture/)) {
                const parts = fullUrl.split('/').filter(p => p && !isNaN(p));
                const devisId = parts.length > 0 ? parseInt(parts[0]) : null;

                if (devisId) {
                    // 1) Marquer facture_generee = true dans le cache /devis
                    const devisCache = await db.api_cache.get('/devis');
                    let devisInfo = null;
                    if (devisCache && Array.isArray(devisCache.data)) {
                        devisInfo = devisCache.data.find(d => d.id_devis === devisId);
                        devisCache.data = devisCache.data.map(d =>
                            d.id_devis === devisId ? { ...d, facture_generee: true } : d
                        );
                        await db.api_cache.put({ url: '/devis', data: devisCache.data });
                    }

                    // 2) Ajouter une facture provisoire dans le cache /factures
                    const montantTotal = devisInfo
                        ? (devisInfo.total || (devisInfo.lignes || []).reduce(
                            (s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0))
                        : 0;
                    
                    let refNum = `${devisId}`;
                    if (devisInfo?.reference && devisInfo.reference.includes('-')) {
                        refNum = devisInfo.reference.split('-')[1];
                    }
                    
                    const tempFacture = {
                        id_facture: Date.now(),
                        reference: `FAC-${refNum} (Offline)`,
                        id_client: devisInfo?.id_client || null,
                        id_devis: devisId,
                        devis_ref: devisInfo?.reference || '',
                        client_nom_utilisateur: devisInfo?.client_nom_utilisateur || '',
                        client_prenom_utilisateur: devisInfo?.client_prenom_utilisateur || '',
                        vehicule_immatriculation: devisInfo?.vehicule_immatriculation || '',
                        montant_total: montantTotal,
                        statut: 'En attente',
                        date_emission: new Date().toISOString(),
                        _offline_temp: true,
                    };
                    const facturesCache = await db.api_cache.get('/factures');
                    if (facturesCache && Array.isArray(facturesCache.data)) {
                        facturesCache.data.push(tempFacture);
                        await db.api_cache.put({ url: '/factures', data: facturesCache.data });
                    } else {
                        await db.api_cache.put({ url: '/factures', data: [tempFacture] });
                    }
                }
                return; // Cas spécial traité, on sort
            }

            // ══ CAS STANDARD : POST/PUT/DELETE ══
            let baseUrl = fullUrl;
            let routeId = null;

            if (method === 'PUT' || method === 'DELETE') {
                const parts = baseUrl.split('/').filter(p => p.length > 0);
                if (isNaN(parts[parts.length - 1])) {
                    parts.pop(); // Enlève l'action (statut, prendre...)
                }
                routeId = parts.pop(); // Extrait l'ID
                baseUrl = '/' + parts.join('/');
            }

            const cacheEntry = await db.api_cache.get(baseUrl);
            if (cacheEntry && Array.isArray(cacheEntry.data)) {
                if (method === 'POST') {
                    const tempId = Date.now();
                    const newObj = {
                        id: tempId,
                        id_vehicule: tempId,
                        id_client: tempId,
                        id_intervention: tempId,
                        id_utilisateur: tempId,
                        id_reparation: tempId,
                        id_piece: tempId,
                        id_facture: tempId,
                        id_devis: tempId,
                        id_rendezvous: tempId,
                        ...requestData
                    };
                    cacheEntry.data.push(newObj);
                } else if (method === 'PUT') {
                    const idVal = parseInt(routeId) || routeId;
                    cacheEntry.data = cacheEntry.data.map(item => {
                        const idKey = Object.keys(item).find(k => k.startsWith('id_') || k === 'id');
                        if (idKey && item[idKey] == idVal) return { ...item, ...requestData };
                        return item;
                    });
                } else if (method === 'DELETE') {
                    const idVal = parseInt(routeId) || routeId;
                    cacheEntry.data = cacheEntry.data.filter(item => {
                        const idKey = Object.keys(item).find(k => k.startsWith('id_') || k === 'id');
                        return item[idKey] != idVal;
                    });
                }
                await db.api_cache.put({ url: baseUrl, data: cacheEntry.data });
            }
        } catch (patchErr) {
            console.warn("Mise à jour optimiste du cache annulée:", patchErr);
        }

    } catch (e) {
        console.error("Erreur de mise en file d'attente hors-ligne:", e);
    }
}

export async function processSyncQueue(api) {
    if (!navigator.onLine) return;

    try {
        const queue = await db.sync_queue.orderBy('timestamp').toArray();
        if (queue.length === 0) return;

        console.log(`Démarrage de la synchronisation de ${queue.length} actions hors-ligne...`);
        let syncedCount = 0;

        for (let item of queue) {
            try {
                await api.request({
                    method: item.method,
                    url: item.url,
                    data: item.data,
                    _isBackgroundSync: true
                });
                await db.sync_queue.delete(item.id);
                syncedCount++;
            } catch (err) {
                console.error("Erreur de synchronisation, annulation du reste du batch:", err);
                break;
            }
        }

        if (syncedCount > 0) {
            // Rafraîchir le cache après synchro réussie
            window.dispatchEvent(new CustomEvent('sync-completed', { detail: syncedCount }));
        }
    } catch (e) {
        console.error("Erreur fatale de synchronisation:", e);
    }
}
