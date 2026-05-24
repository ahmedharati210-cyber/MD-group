-- Official paper categories: سجل / رخصة / غرفة رمز الاحصاء (plus existing contract / other)
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'record';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'license';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'stats_code';
