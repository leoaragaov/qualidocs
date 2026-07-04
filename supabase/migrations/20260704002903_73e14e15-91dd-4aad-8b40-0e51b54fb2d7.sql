
-- Change FK to SET NULL so audit trail persists even after project deletion
ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_project_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- Update audit trigger: on DELETE of a project row, log without linking project_id
-- (project row is already gone by AFTER DELETE, so the FK insert would fail)
CREATE OR REPLACE FUNCTION public.tms_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project UUID;
  v_entity_id UUID;
  v_action public.audit_action;
  v_diff JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_diff := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'projects' THEN
      v_project := NULL; -- project row is gone; keep audit row unlinked
    ELSE
      v_project := OLD.project_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := NEW.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    IF TG_TABLE_NAME = 'projects' THEN v_project := NEW.id;
    ELSE v_project := NEW.project_id; END IF;
  ELSE
    v_action := 'create';
    v_entity_id := NEW.id;
    v_diff := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'projects' THEN v_project := NEW.id;
    ELSE v_project := NEW.project_id; END IF;
  END IF;

  INSERT INTO public.audit_logs (project_id, actor_id, entity, entity_id, action, diff)
  VALUES (v_project, auth.uid(), TG_TABLE_NAME, v_entity_id, v_action, v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $function$;
