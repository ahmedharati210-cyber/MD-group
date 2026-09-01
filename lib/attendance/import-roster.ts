export type ImportRosterEntry = {
  externalEmployeeNumber: string;
  employeeName: string;
  departmentHint: string | null;
  isNewPerson: boolean;
};

type NamedBlock = {
  externalEmployeeNumber?: string | null;
  employeeName?: string | null;
  departmentHint?: string | null;
};

/**
 * Distinct fingerprint IDs from parsed blocks, including people with no punches.
 */
export function rosterEntriesFromBlocks(
  blocks: NamedBlock[],
  peopleByExternal: Map<string, unknown>,
): ImportRosterEntry[] {
  const byExt = new Map<string, ImportRosterEntry>();
  for (const block of blocks) {
    const ext = block.externalEmployeeNumber?.trim();
    if (!ext || byExt.has(ext)) continue;
    byExt.set(ext, {
      externalEmployeeNumber: ext,
      employeeName: block.employeeName?.trim() || `موظف ${ext}`,
      departmentHint: block.departmentHint ?? null,
      isNewPerson: !peopleByExternal.has(ext),
    });
  }
  return [...byExt.values()];
}

export function unionRosterEntries(
  rosterEntries: ImportRosterEntry[],
  rows: Array<{
    externalEmployeeNumber: string;
    employeeName: string;
    departmentHint: string | null;
    isNewPerson: boolean;
  }>,
): ImportRosterEntry[] {
  const byExt = new Map<string, ImportRosterEntry>();
  for (const entry of rosterEntries) {
    byExt.set(entry.externalEmployeeNumber, entry);
  }
  for (const row of rows) {
    const ext = row.externalEmployeeNumber?.trim();
    if (!ext || byExt.has(ext)) continue;
    byExt.set(ext, {
      externalEmployeeNumber: ext,
      employeeName: row.employeeName,
      departmentHint: row.departmentHint,
      isNewPerson: row.isNewPerson,
    });
  }
  return [...byExt.values()];
}

export function newPeoplePreviewFromRoster(
  entries: ImportRosterEntry[],
): Array<{ externalNumber: string; name: string }> {
  return entries
    .filter((entry) => entry.isNewPerson)
    .map((entry) => ({
      externalNumber: entry.externalEmployeeNumber,
      name: entry.employeeName,
    }));
}

export type RosterExistingIdentity = {
  full_name: string;
  active: boolean;
};

/**
 * New people get the file name and start active. Existing people keep their
 * stored name (unless empty) and active flag so imports cannot revive a
 * deactivated person or overwrite a manual name correction.
 */
export function resolveRosterUpsertIdentity(
  incomingName: string,
  existing: RosterExistingIdentity | undefined,
): { full_name: string; active: boolean } {
  if (!existing) {
    return { full_name: incomingName, active: true };
  }
  const existingName = existing.full_name.trim();
  return {
    full_name: existingName || incomingName,
    active: existing.active,
  };
}
