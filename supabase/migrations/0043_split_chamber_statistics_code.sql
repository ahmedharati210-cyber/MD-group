-- Split combined stats_code into غرفة (chamber) and رمز الاحصاء (statistics_code).
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'chamber';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'statistics_code';
