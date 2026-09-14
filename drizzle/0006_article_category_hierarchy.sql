DROP TRIGGER category_insert_guard;
--> statement-breakpoint
DROP TRIGGER category_update_guard;
--> statement-breakpoint
CREATE TRIGGER category_insert_guard BEFORE INSERT ON categories
WHEN NEW.kind NOT IN ('articles','products') OR (NEW.parent_id IS NOT NULL AND (NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.parent_id AND kind=NEW.kind AND parent_id IS NULL) OR EXISTS(SELECT 1 FROM categories WHERE parent_id=NEW.id)))
BEGIN SELECT RAISE(ABORT, 'Invalid category hierarchy'); END;
--> statement-breakpoint
CREATE TRIGGER category_update_guard BEFORE UPDATE ON categories
WHEN NEW.kind!=OLD.kind OR (NEW.parent_id IS NOT NULL AND (NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.parent_id AND kind=NEW.kind AND parent_id IS NULL) OR EXISTS(SELECT 1 FROM categories WHERE parent_id=NEW.id)))
BEGIN SELECT RAISE(ABORT, 'Invalid category hierarchy'); END;
