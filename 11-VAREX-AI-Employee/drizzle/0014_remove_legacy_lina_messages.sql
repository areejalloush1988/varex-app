UPDATE `ai_chat_messages`
SET `body` = REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              `body`,
              'Lina AI',
              COALESCE((SELECT `name` FROM `ai_agents` WHERE `ai_agents`.`id` = `ai_chat_messages`.`agent_id` AND `ai_agents`.`organization_id` = `ai_chat_messages`.`organization_id` LIMIT 1), 'الموظف الذكي')
            ),
            'Lina',
            COALESCE((SELECT `name` FROM `ai_agents` WHERE `ai_agents`.`id` = `ai_chat_messages`.`agent_id` AND `ai_agents`.`organization_id` = `ai_chat_messages`.`organization_id` LIMIT 1), 'الموظف الذكي')
          ),
          'LINA',
          COALESCE((SELECT `name` FROM `ai_agents` WHERE `ai_agents`.`id` = `ai_chat_messages`.`agent_id` AND `ai_agents`.`organization_id` = `ai_chat_messages`.`organization_id` LIMIT 1), 'الموظف الذكي')
        ),
        'lina',
        COALESCE((SELECT `name` FROM `ai_agents` WHERE `ai_agents`.`id` = `ai_chat_messages`.`agent_id` AND `ai_agents`.`organization_id` = `ai_chat_messages`.`organization_id` LIMIT 1), 'الموظف الذكي')
      ),
      'لينا',
      COALESCE((SELECT `name` FROM `ai_agents` WHERE `ai_agents`.`id` = `ai_chat_messages`.`agent_id` AND `ai_agents`.`organization_id` = `ai_chat_messages`.`organization_id` LIMIT 1), 'الموظف الذكي')
    ),
    `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `role` = 'assistant'
  AND (
    LOWER(`body`) LIKE 'i am lina%'
    OR LOWER(`body`) LIKE 'my name is lina%'
    OR LOWER(`body`) LIKE '%lina ai%'
    OR `body` LIKE 'أنا لينا%'
    OR `body` LIKE 'اسمي لينا%'
    OR `body` LIKE '%أنا مساعدتك لينا%'
  );
