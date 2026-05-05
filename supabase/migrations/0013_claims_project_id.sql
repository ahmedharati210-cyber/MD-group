-- Add project association to manager_claims
alter table manager_claims
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists manager_claims_project_id_idx on manager_claims(project_id);
