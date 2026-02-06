// Runtime configuration for evroc storage
export interface EvrocConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export const getEvrocConfig = (): EvrocConfig => {
  return {
    endpoint: import.meta.env.VITE_EVROC_ENDPOINT || 'https://storage.services.evroc.cloud/',
    region: import.meta.env.VITE_EVROC_REGION || 'sto-1',
    bucket: import.meta.env.VITE_EVROC_BUCKET || 'my-bucket',
    accessKey: import.meta.env.VITE_EVROC_ACCESS_KEY || '7N5KDVEX5G4VPOK73YQW',
    secretKey: import.meta.env.VITE_EVROC_SECRET_KEY || 'KFMUTGIFMBBFK2JYDEQJ4K4OOLN75JSEYQDO2GWR',
  };
};