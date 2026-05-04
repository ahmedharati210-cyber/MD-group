-- Add two new project status values requested by company managers.
-- PostgreSQL enum values can only be added, not removed.
alter type project_status add value if not exists 'maintenance';
alter type project_status add value if not exists 'survey';
