ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeStructure" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'FeeStructure' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "FeeStructure"
      USING ("tenantId" = current_setting('app.current_tenant_id'))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id'));
  END IF;
END $$;

ALTER TABLE "FeeRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeRecord" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'FeeRecord' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "FeeRecord"
      USING ("tenantId" = current_setting('app.current_tenant_id'))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id'));
  END IF;
END $$;

ALTER TABLE "FeeDiscount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeDiscount" FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'FeeDiscount' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON "FeeDiscount"
      USING ("tenantId" = current_setting('app.current_tenant_id'))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant_id'));
  END IF;
END $$;
