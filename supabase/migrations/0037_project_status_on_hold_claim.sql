-- Stopped for claims / مطالبة (distinct from general on hold)
alter type project_status add value if not exists 'on_hold_claim';
