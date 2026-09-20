UPDATE `ai_agents`
SET `name` = 'الموظف الذكي',
    `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE LOWER(TRIM(`name`)) IN ('lina', 'lina ai')
   OR TRIM(`name`) = 'لينا';
