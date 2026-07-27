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
  v_exists BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_diff := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'projects' THEN
      v_project := NULL;
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

  -- If the referenced project no longer exists (e.g. cascading delete),
  -- store the audit row with a NULL project_id to avoid FK violation.
  IF v_project IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE id = v_project) INTO v_exists;
    IF NOT v_exists THEN
      v_project := NULL;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (project_id, actor_id, entity, entity_id, action, diff)
  VALUES (v_project, auth.uid(), TG_TABLE_NAME, v_entity_id, v_action, v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $function$;