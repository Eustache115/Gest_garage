import Dexie from 'dexie';

export const db = new Dexie('EGarageLocalDB');

// Version 2 : Modèle robuste avec un cache générique par URL
db.version(2).stores({
    api_cache: 'url', // La clé primaire est l'URL de l'API
    sync_queue: '++id, method, url, data, timestamp'
});
