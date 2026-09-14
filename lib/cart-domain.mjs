export const mergeCartSql='INSERT INTO cart_items SELECT ?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM cart_items WHERE user_id=? AND product_id=? AND variant=?) ON CONFLICT(user_id,product_id,variant) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at WHERE cart_items.quantity IN (?,excluded.quantity)';

export const replaceCartVariantSql='UPDATE cart_items SET variant=?,updated_at=? WHERE id=? AND user_id=? AND product_id=? AND NOT EXISTS (SELECT 1 FROM cart_items other WHERE other.user_id=? AND other.product_id=? AND other.variant=? AND other.id<>?)';
