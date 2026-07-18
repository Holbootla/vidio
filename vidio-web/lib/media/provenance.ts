export interface MediaProvenance {
  manifestId: string;
  installationId?: string;
  addonName?: string;
  catalogId?: string;
}

const PROVENANCE_KEYS = {
  manifestId: "manifest_id",
  installationId: "installation_id",
  addonName: "addon_name",
  catalogId: "catalog_id",
} as const;

export function provenanceToSearchParams(provenance: MediaProvenance): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PROVENANCE_KEYS.manifestId, provenance.manifestId);
  if (provenance.installationId) {
    params.set(PROVENANCE_KEYS.installationId, provenance.installationId);
  }
  if (provenance.addonName) {
    params.set(PROVENANCE_KEYS.addonName, provenance.addonName);
  }
  if (provenance.catalogId) {
    params.set(PROVENANCE_KEYS.catalogId, provenance.catalogId);
  }
  return params;
}

export function buildDetailHref(
  contentType: string,
  id: string,
  provenance?: MediaProvenance | null,
): string {
  const encodedType = encodeURIComponent(contentType);
  const encodedId = encodeURIComponent(id);
  const base = `/detail/${encodedType}/${encodedId}`;
  if (!provenance?.manifestId) {
    return base;
  }
  const params = provenanceToSearchParams(provenance);
  return `${base}?${params.toString()}`;
}

export function parseProvenanceFromSearchParams(
  params: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>,
): MediaProvenance | null {
  const read = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      const value = params.get(key);
      return value ?? undefined;
    }
    const raw = params[key];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return raw;
  };

  const manifestId = read(PROVENANCE_KEYS.manifestId);
  if (!manifestId) {
    return null;
  }

  return {
    manifestId,
    installationId: read(PROVENANCE_KEYS.installationId),
    addonName: read(PROVENANCE_KEYS.addonName),
    catalogId: read(PROVENANCE_KEYS.catalogId),
  };
}

export function catalogRowProvenance(
  row: {
    installation_id: string;
    addon_name: string;
    catalog_id: string;
  },
  manifestId: string,
): MediaProvenance {
  return {
    manifestId,
    installationId: row.installation_id,
    addonName: row.addon_name,
    catalogId: row.catalog_id,
  };
}
