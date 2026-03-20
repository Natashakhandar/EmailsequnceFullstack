-- Fix for UnsubscribeToken table - Add contact foreign key relation

-- Check if the foreign key already exists
-- If it doesn't exist, add it

ALTER TABLE `unsubscribe_tokens` 
ADD CONSTRAINT `unsubscribe_tokens_contactId_fkey` 
FOREIGN KEY (`contactId`) 
REFERENCES `contacts`(`id`) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Verify the relation was created
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'unsubscribe_tokens' AND COLUMN_NAME = 'contactId';
