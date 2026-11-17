BEGIN;
SET LOCAL lock_timeout='15s';
-- Add links without guessing ownership or modifying existing definitions.
ALTER TABLE accounting_details ADD COLUMN "sourceConfigurationId" uuid, ADD COLUMN "sourceAccountId" uuid;
ALTER TABLE accounting_details ADD CONSTRAINT detail_source_config_fk FOREIGN KEY ("sourceConfigurationId","bookId") REFERENCES accounting_configurations(id,"bookId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE accounting_details ADD CONSTRAINT detail_source_account_fk FOREIGN KEY ("sourceAccountId") REFERENCES "FinanceSettlementAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX detail_source_config_idx ON accounting_details("sourceConfigurationId","bookId");
CREATE INDEX detail_source_account_idx ON accounting_details("sourceAccountId");
-- Never alter an existing definition's ID, width, activity or attributes.
LOCK TABLE accounting_configurations IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO accounting_configurations(id,"bookId",kind,code,title,attributes,active,version,"createdAt","updatedAt")
SELECT gen_random_uuid(),b.id,'detail-types','DT-'||gen_random_uuid()::text,t.title,
 jsonb_build_object('isSystem',true,'classificationNumberLength','8','defaultFirstCode','','parentTypeId','','enforceParent',false),true,1,now(),now()
FROM accounting_books b CROSS JOIN (VALUES ('PETTY_CASH','تنخواه'),('CASH','صندوق'),('BANK','حساب بانکی'),('FISCAL_YEAR','دوره مالی'),('FUND','منبع تامین اعتبار'),('PROJECT','پروژه'),('COST_CENTER','مرکز هزینه'),('BRANCH','شعبه')) t(key,title)
WHERE NOT EXISTS(SELECT 1 FROM accounting_configurations c WHERE c."bookId"=b.id AND c.kind='detail-types'
 AND replace(replace(replace(replace(replace(c.title,'ي','ی'),'ك','ک'),'تأمین','تامین'),' ',''),'‌','')=replace(t.title,' ',''));

COMMIT;
