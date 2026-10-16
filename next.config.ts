import type { NextConfig } from 'next';

const config: NextConfig = {
  // El kit se consume tal cual lo publica GitHub Packages (ESM compilado). Se transpila igual
  // para que Next resuelva sus subpaths (`/dominio`, `/capacidad`) con el mismo React y antd de la app.
  transpilePackages: ['@arc2-0/claro-one-kit'],
  experimental: {
    optimizePackageImports: ['antd', 'lucide-react'],
    // La importación de leads sube un .xlsx de hasta 5 MB y luego sus filas (H-025).
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default config;
