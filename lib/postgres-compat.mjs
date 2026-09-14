// Install in the CMS database during migration using its schema-owner role.
export const postgresCompatibilitySql = `
CREATE OR REPLACE FUNCTION cms_json_path(path text) RETURNS text[] LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN path='$' THEN ARRAY[]::text[] ELSE string_to_array(substr(path,3),'.') END
$$;
CREATE OR REPLACE FUNCTION cms_json_set(doc text,path text,value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result jsonb := doc::jsonb; parts text[] := cms_json_path(path); i integer;
BEGIN
 IF array_length(parts,1) IS NULL THEN RETURN coalesce(value,'null'::jsonb)::text; END IF;
 FOR i IN 1..array_length(parts,1)-1 LOOP
  IF result #> parts[1:i] IS NULL THEN result := jsonb_set(result,parts[1:i],'{}'::jsonb,true); END IF;
 END LOOP;
 RETURN jsonb_set(result,parts,coalesce(value,'null'::jsonb),true)::text;
END $$;
CREATE OR REPLACE FUNCTION cms_json_patch(target jsonb,patch jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result jsonb; pair record;
BEGIN
 IF jsonb_typeof(patch)<>'object' THEN RETURN patch; END IF;
 result := CASE WHEN jsonb_typeof(target)='object' THEN target ELSE '{}'::jsonb END;
 FOR pair IN SELECT key,value FROM jsonb_each(patch) LOOP
  IF pair.value='null'::jsonb THEN result:=result-pair.key;
  ELSE result:=jsonb_set(result,ARRAY[pair.key],cms_json_patch(result->pair.key,pair.value),true); END IF;
 END LOOP;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION cms_json_each(doc jsonb,path text DEFAULT '$') RETURNS TABLE(key text,value text) LANGUAGE sql IMMUTABLE AS $$
 WITH node AS (SELECT doc #> cms_json_path(path) AS v)
 SELECT e.key,CASE WHEN e.value='null'::jsonb THEN NULL WHEN e.value='true'::jsonb THEN '1' WHEN e.value='false'::jsonb THEN '0' WHEN jsonb_typeof(e.value)='string' THEN e.value #>> '{}' ELSE e.value::text END
 FROM node,LATERAL jsonb_each(CASE WHEN jsonb_typeof(v)='object' THEN v ELSE '{}'::jsonb END) e
 UNION ALL
 SELECT (a.ordinality-1)::text,CASE WHEN a.value='null'::jsonb THEN NULL WHEN a.value='true'::jsonb THEN '1' WHEN a.value='false'::jsonb THEN '0' WHEN jsonb_typeof(a.value)='string' THEN a.value #>> '{}' ELSE a.value::text END
 FROM node,LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(v)='array' THEN v ELSE '[]'::jsonb END) WITH ORDINALITY a
$$;
CREATE OR REPLACE FUNCTION cms_json_tree(doc jsonb) RETURNS TABLE(value text) LANGUAGE sql IMMUTABLE AS $$
 WITH RECURSIVE nodes(v) AS (
  SELECT doc UNION ALL SELECT child.value FROM nodes n,LATERAL (
   SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END)
   UNION ALL SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.v)='array' THEN n.v ELSE '[]'::jsonb END)
  ) child
 ) SELECT CASE WHEN v='null'::jsonb THEN NULL WHEN v='true'::jsonb THEN '1' WHEN v='false'::jsonb THEN '0' WHEN jsonb_typeof(v)='string' THEN v #>> '{}' ELSE v::text END FROM nodes
$$;
`;
