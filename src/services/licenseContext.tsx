import React, { createContext, useContext } from 'react';
import type { TadeuLicense } from './tadeuLicense';
import { getLicensedLimit, hasLicensedFeature } from './tadeuLicense';

type Value = {
  license: TadeuLicense | null;
  refresh: () => Promise<void>;
  hasFeature: (key: string) => boolean;
  getLimit: (key: string) => { value: number; unit: string | null } | null;
};

const LicenseContext = createContext<Value | null>(null);

export function LicenseProvider(props: {
  license: TadeuLicense | null;
  refresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { license, refresh, children } = props;
  const value: Value = {
    license,
    refresh,
    hasFeature: (key) => hasLicensedFeature(license, key),
    getLimit: (key) => getLicensedLimit(license, key),
  };
  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const value = useContext(LicenseContext);
  if (!value) throw new Error('LicenseProvider ausente.');
  return value;
}
